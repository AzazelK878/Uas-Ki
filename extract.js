document.getElementById('extractButton').addEventListener('click', extractMessage);

function extractMessage() {
    const audioInput = document.getElementById('audioInput').files[0];

    if (audioInput) {
        const reader = new FileReader();

        reader.onload = function(event) {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();

            audioContext.decodeAudioData(event.target.result, function(buffer) {
                const message = extractMessageFromBuffer(buffer);
                document.getElementById('extractedMessage').value = message;
            });
        };

        reader.readAsArrayBuffer(audioInput);
    } else {
        alert('Please select an audio file.');
    }
}

function extractMessageFromBuffer(buffer) {
    const sampleRate = buffer.sampleRate;
    const data = buffer.getChannelData(0); // Assume mono channel for simplicity

    const carrierFreq0 = 1000; // Frequency for bit 0
    const carrierFreq1 = 2000; // Frequency for bit 1
    const duration = 0.01; // Duration of one bit in seconds
    const samplesCount = Math.floor(sampleRate * duration);

    // Extract the length prefix (16 bits)
    let lengthBinary = '';
    for (let i = 0; i < 16; i++) {
        const bit = extractBitFromSignal(data, i * samplesCount, samplesCount, carrierFreq0, carrierFreq1, sampleRate);
        lengthBinary += bit;
    }

    const messageLength = parseInt(lengthBinary, 2);

    // Extract the message
    let messageBinary = '';
    for (let i = 0; i < messageLength; i++) {
        const bit = extractBitFromSignal(data, (i + 16) * samplesCount, samplesCount, carrierFreq0, carrierFreq1, sampleRate);
        messageBinary += bit;
    }

    return binaryToString(messageBinary);
}

function extractBitFromSignal(data, startIndex, samplesCount, carrierFreq0, carrierFreq1, sampleRate) {
    let sum0 = 0;
    let sum1 = 0;

    for (let i = 0; i < samplesCount; i++) {
        const sampleIndex = startIndex + i;

        if (sampleIndex < data.length) {
            const time = i / sampleRate;
            sum0 += data[sampleIndex] * Math.sin(2 * Math.PI * carrierFreq0 * time);
            sum1 += data[sampleIndex] * Math.sin(2 * Math.PI * carrierFreq1 * time);
        }
    }

    // Determine bit based on which frequency has a higher correlation
    return sum1 > sum0 ? '1' : '0';
}

function binaryToString(binary) {
    return binary.match(/.{1,8}/g).map(byte => {
        return String.fromCharCode(parseInt(byte, 2));
    }).join('');
}