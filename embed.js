document.getElementById('embedButton').addEventListener('click', embedMessage);

function embedMessage() {
    const audioInput = document.getElementById('audioInput').files[0];
    const message = document.getElementById('messageInput').value;

    if (audioInput && message) {
        const reader = new FileReader();

        reader.onload = function(event) {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();

            audioContext.decodeAudioData(event.target.result, function(buffer) {
                const modifiedBuffer = embedMessageUsingFMT(buffer, message);

                const offlineContext = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
                const bufferSource = offlineContext.createBufferSource();
                bufferSource.buffer = modifiedBuffer;
                bufferSource.connect(offlineContext.destination);
                bufferSource.start();

                offlineContext.startRendering().then(renderedBuffer => {
                    const audioBlob = bufferToWave(renderedBuffer, renderedBuffer.length);
                    const url = URL.createObjectURL(audioBlob);

                    const audioOutput = document.getElementById('audioOutput');
                    audioOutput.src = url;
                    audioOutput.load();

                    const downloadLink = document.createElement('a');
                    downloadLink.href = url;
                    downloadLink.download = 'embedded_message.wav';
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);
                }).catch(err => {
                    console.error('Rendering failed: ' + err);
                });
            }, function(err) {
                console.error('Decoding failed: ' + err);
            });
        };

        reader.readAsArrayBuffer(audioInput);
    } else {
        alert('Please select an audio file and enter a message.');
    }
}

function embedMessageUsingFMT(buffer, message) {
    const sampleRate = buffer.sampleRate;
    const data = buffer.getChannelData(0); // Assume mono channel for simplicity
    const messageBinary = stringToBinary(message);
    const messageLengthBinary = messageBinary.length.toString(2).padStart(16, '0'); // 16-bit length prefix

    const carrierFreq0 = 1000; // Frequency for bit 0
    const carrierFreq1 = 2000; // Frequency for bit 1
    const modulationIndex = 1;
    const duration = 0.01; // Duration of one bit in seconds
    const samplesCount = Math.floor(sampleRate * duration);

    let currentIndex = 0;

    const fullMessageBinary = messageLengthBinary + messageBinary;

    for (let i = 0; i < fullMessageBinary.length; i++) {
        const bit = parseInt(fullMessageBinary[i], 2);
        const modulatedSignal = createFMTSignal(bit, carrierFreq0, carrierFreq1, modulationIndex, sampleRate);

        for (let j = 0; j < modulatedSignal.length; j++) {
            if (currentIndex + j < data.length) {
                data[currentIndex + j] += modulatedSignal[j];
            }
        }

        currentIndex += samplesCount;
    }

    return buffer;
}

function createFMTSignal(bit, carrierFreq0, carrierFreq1, modulationIndex, sampleRate) {
    const duration = 0.01; // Duration of one bit in seconds
    const samplesCount = Math.floor(sampleRate * duration);
    const signal = new Float32Array(samplesCount);
    const carrierFreq = bit === 0 ? carrierFreq0 : carrierFreq1;

    for (let i = 0; i < samplesCount; i++) {
        const time = i / sampleRate;
        signal[i] = Math.sin(2 * Math.PI * carrierFreq * time + modulationIndex * bit);
    }

    return signal;
}

function stringToBinary(str) {
    return str.split('').map(char => {
        return char.charCodeAt(0).toString(2).padStart(8, '0');
    }).join('');
}

function bufferToWave(abuffer, len) {
    var numOfChan = abuffer.numberOfChannels,
        length = len * numOfChan * 2 + 44,
        buffer = new ArrayBuffer(length),
        view = new DataView(buffer),
        channels = [],
        i,
        sample,
        offset = 0,
        pos = 0;

    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit (hardcoded in this demo)
    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    for (i = 0; i < abuffer.numberOfChannels; i++)
        channels.push(abuffer.getChannelData(i));

    while (pos < length) {
        for (i = 0; i < numOfChan; i++) { // interleave channels
            sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
            sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF) | 0; // scale to 16-bit signed int
            view.setInt16(pos, sample, true); // write 16-bit sample
            pos += 2;
        }
        offset++; // next source sample
    }

    return new Blob([buffer], { type: "audio/wav" });

    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    }
}