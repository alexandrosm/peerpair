// Ultra-efficient binary codec for WebRTC signaling

export function encodeBinary(data) {
    const buffer = [];
    
    // 1 byte: type (high bit) + setup (low 2 bits)
    const typeBit = data.t === 'o' ? 0x80 : 0x00;
    const setupBits = data.s === 'a' ? 0x01 : data.s === 'p' ? 0x02 : 0x03;
    buffer.push(typeBit | setupBits);
    
    // 4 bytes: ufrag (pad or truncate to 4 bytes)
    const ufrag = data.u || '';
    for (let i = 0; i < 4; i++) {
        buffer.push(i < ufrag.length ? ufrag.charCodeAt(i) : 0);
    }
    
    // 24 bytes: pwd (pad or truncate to 24 bytes)
    const pwd = data.p || '';
    for (let i = 0; i < 24; i++) {
        buffer.push(i < pwd.length ? pwd.charCodeAt(i) : 0);
    }
    
    // Fingerprint (convert from hex to binary)
    // Detect hash type from length: SHA-1=40, SHA-256=64, SHA-384=96, SHA-512=128 hex chars
    const fpHex = (data.f || '').replace(/:/g, '');
    const fpBytes = fpHex.length / 2;
    
    // Add fingerprint length byte
    buffer.push(fpBytes);
    
    for (let i = 0; i < fpHex.length; i += 2) {
        buffer.push(parseInt(fpHex.substr(i, 2), 16));
    }
    
    // 1 byte: number of candidates
    const candidates = data.c || [];
    buffer.push(candidates.length);
    
    // Encode each candidate
    candidates.forEach(cand => {
        const parts = cand.split(',');
        const type = parts[0];
        
        // 1 byte: candidate type
        buffer.push(type === 'h' ? 0x01 : type === 's' ? 0x02 : 0x03);
        
        if (type === 'h' || type === 'r') {
            // Host/Relay: IP (4 bytes) + port (2 bytes)
            const [ip, port] = parts[1].split(':');
            ip.split('.').forEach(octet => buffer.push(parseInt(octet)));
            const portNum = parseInt(port);
            buffer.push((portNum >> 8) & 0xFF);
            buffer.push(portNum & 0xFF);
        } else if (type === 's') {
            // SRFLX: 2 IPs + 2 ports
            const [ip1, port1] = parts[1].split(':');
            const [ip2, port2] = parts[2].split(':');
            
            ip1.split('.').forEach(octet => buffer.push(parseInt(octet)));
            const port1Num = parseInt(port1);
            buffer.push((port1Num >> 8) & 0xFF);
            buffer.push(port1Num & 0xFF);
            
            ip2.split('.').forEach(octet => buffer.push(parseInt(octet)));
            const port2Num = parseInt(port2);
            buffer.push((port2Num >> 8) & 0xFF);
            buffer.push(port2Num & 0xFF);
        }
    });
    
    return new Uint8Array(buffer);
}

export function decodeBinary(bytes) {
    let offset = 0;
    
    // 1 byte: type + setup
    const typeByte = bytes[offset++];
    const type = (typeByte & 0x80) ? 'o' : 'a';
    const setup = (typeByte & 0x03) === 0x01 ? 'a' : 
                  (typeByte & 0x03) === 0x02 ? 'p' : 'c';
    
    // 4 bytes: ufrag
    let ufrag = '';
    for (let i = 0; i < 4; i++) {
        if (bytes[offset] !== 0) {
            ufrag += String.fromCharCode(bytes[offset]);
        }
        offset++;
    }
    
    // 24 bytes: pwd
    let pwd = '';
    for (let i = 0; i < 24; i++) {
        if (bytes[offset] !== 0) {
            pwd += String.fromCharCode(bytes[offset]);
        }
        offset++;
    }
    
    // Read fingerprint length byte
    const fpLength = bytes[offset++];
    console.log('Binary decode - fingerprint length byte:', fpLength);
    console.log('Binary decode - offset before fingerprint:', offset);
    
    let fingerprint = '';
    for (let i = 0; i < fpLength && offset < bytes.length - 1; i++) {
        const hex = bytes[offset++].toString(16).padStart(2, '0').toUpperCase();
        fingerprint += hex;
        if (i < fpLength - 1) fingerprint += ':';
    }
    
    // 1 byte: candidate count
    console.log('Binary decode - offset after fingerprint:', offset);
    console.log('Binary decode - bytes remaining:', bytes.length - offset);
    const candidateCount = bytes[offset++];
    console.log('Binary decode - candidate count:', candidateCount);
    const candidates = [];
    
    // Decode candidates
    for (let i = 0; i < candidateCount; i++) {
        const candType = bytes[offset++];
        
        if (candType === 0x01 || candType === 0x03) {
            // Host or Relay
            const ip = `${bytes[offset++]}.${bytes[offset++]}.${bytes[offset++]}.${bytes[offset++]}`;
            const port = (bytes[offset++] << 8) | bytes[offset++];
            candidates.push(`${candType === 0x01 ? 'h' : 'r'},${ip}:${port}`);
        } else if (candType === 0x02) {
            // SRFLX
            const ip1 = `${bytes[offset++]}.${bytes[offset++]}.${bytes[offset++]}.${bytes[offset++]}`;
            const port1 = (bytes[offset++] << 8) | bytes[offset++];
            const ip2 = `${bytes[offset++]}.${bytes[offset++]}.${bytes[offset++]}.${bytes[offset++]}`;
            const port2 = (bytes[offset++] << 8) | bytes[offset++];
            candidates.push(`s,${ip1}:${port1},${ip2}:${port2}`);
        }
    }
    
    return {
        t: type,
        u: ufrag,
        p: pwd,
        f: fingerprint,
        s: setup,
        c: candidates
    };
}

// Export for use in HTML
if (typeof window !== 'undefined') {
    window.encodeBinary = encodeBinary;
    window.decodeBinary = decodeBinary;
}