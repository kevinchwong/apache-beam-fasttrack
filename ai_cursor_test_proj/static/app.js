document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('upload-form');
    const convertBtn = document.getElementById('convert-btn');
    const progressBar = document.getElementById('progress-bar');
    const progress = document.getElementById('progress');
    const resultDiv = document.getElementById('result');
    const player = document.getElementById('player');
    const playInputBtn = document.getElementById('play-input');
    const playOutputBtn = document.getElementById('play-output');
    const stopInputBtn = document.getElementById('stop-input');
    const stopOutputBtn = document.getElementById('stop-output');
    const xmlOutputDiv = document.getElementById('xml-output');
    const historyPane = document.getElementById('history-pane');
    const historyList = document.getElementById('history-list');
    const toggleScoreBtn = document.getElementById('toggle-score');
    const scoreContainer = document.getElementById('score-container');
    const toggleXmlBtn = document.getElementById('toggle-xml');
    let osmd;

    let inputMidiUrl, outputMidiUrl, outputXmlUrl;
    let currentSynth = null;
    let isPlaying = false;
    let conversionHistory = [];

    let audioContext;

    const sheetMusicInput = document.getElementById('sheet-music');
    let originalFile = null;
    let conversionHappened = false;

    // Disable play buttons by default
    playInputBtn.disabled = true;
    playOutputBtn.disabled = true;

    sheetMusicInput.addEventListener('change', (e) => {
        originalFile = e.target.files[0];
        if (originalFile) {
            playInputBtn.disabled = false;
        } else {
            playInputBtn.disabled = true;
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);

        convertBtn.disabled = true;
        progressBar.style.display = 'block';
        progress.style.width = '0%';
        resultDiv.innerHTML = '转换中...';
        resultDiv.style.display = 'block'; // Make sure the result div is visible

        try {
            const response = await fetch('/convert', {
                method: 'POST',
                body: formData
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = JSON.parse(line.slice(6));
                        if ('progress' in data) {
                            progress.style.width = `${data.progress}%`;
                        } else if ('input_midi' in data && 'output_midi' in data && 'output_xml' in data) {
                            inputMidiUrl = data.input_midi;
                            outputMidiUrl = data.output_midi;
                            outputXmlUrl = data.output_xml;

                            // Enable play buttons after successful conversion
                            playInputBtn.disabled = false;
                            playOutputBtn.disabled = false;
                            conversionHappened = true;

                            // Add to history
                            const historyItem = {
                                inputMidi: inputMidiUrl,
                                outputMidi: outputMidiUrl,
                                outputXml: outputXmlUrl,
                                timestamp: new Date().toLocaleString()
                            };
                            conversionHistory.unshift(historyItem);
                            updateHistoryList();
                            historyPane.style.display = 'block';

                            // 更新 UI
                            resultDiv.innerHTML = '转换成功！您现在可以播放原始乐谱和无伴奏合唱版本。';
                            player.style.display = 'block';
                            playInputBtn.disabled = false;
                            playOutputBtn.disabled = false;

                            // 显示 XML
                            await fetchAndDisplayXml(outputXmlUrl);
                        } else if ('error' in data) {
                            throw new Error(data.error);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error during conversion:', error);
            resultDiv.innerHTML = `错误: ${error.message}`;
            resultDiv.style.display = 'block'; // Ensure the result div is visible even in case of an error
            player.style.display = 'none'; // Hide the player in case of an error
        } finally {
            convertBtn.disabled = false;
            progressBar.style.display = 'none';
        }
    });

    async function fetchAndDisplayXml(url) {
        if (!url) {
            console.error('XML URL is undefined');
            alert('XML 文件未找到，请先转换乐谱。');
            return;
        }

        try {
            const response = await fetch(`/get_file/${encodeURIComponent(url)}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch XML');
            }
            const xmlContent = await response.text();
            xmlOutputDiv.innerHTML = `<pre>${escapeHtml(xmlContent)}</pre>`;
            xmlOutputDiv.style.display = 'block';

            // Display the MusicXML as a score
            await displayMusicXML(xmlContent);
        } catch (error) {
            console.error('Error fetching XML:', error);
            alert('无法加载MusicXML，请稍后再试。错误: ' + error.message);
        }
    }

    async function displayMusicXML(xmlContent) {
        if (!osmd) {
            osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay("score-container", {
                autoResize: true,
                drawTitle: true,
            });
        }

        try {
            await osmd.load(xmlContent);
            osmd.render();
            scoreContainer.style.display = 'block';
            toggleScoreBtn.style.display = 'block';
            toggleScoreBtn.textContent = '隐藏乐谱';
            
            xmlOutputDiv.innerHTML = `<h2>生成的 MusicXML 输出</h2><div class="xml-content"><pre>${escapeHtml(xmlContent)}</pre></div>`;
            xmlOutputDiv.style.display = 'none';
            toggleXmlBtn.style.display = 'block';
            toggleXmlBtn.textContent = '显示 MusicXML';
        } catch (error) {
            console.error('Error rendering MusicXML:', error);
            alert('无法显乐谱，请检查 MusicXML 文件。');
        }
    }

    toggleScoreBtn.addEventListener('click', () => {
        if (scoreContainer.style.display === 'none') {
            scoreContainer.style.display = 'block';
            toggleScoreBtn.textContent = '隐藏乐谱';
        } else {
            scoreContainer.style.display = 'none';
            toggleScoreBtn.textContent = '显示乐谱';
        }
    });

    toggleXmlBtn.addEventListener('click', () => {
        if (xmlOutputDiv.style.display === 'none') {
            xmlOutputDiv.style.display = 'block';
            toggleXmlBtn.textContent = '隐藏 MusicXML';
        } else {
            xmlOutputDiv.style.display = 'none';
            toggleXmlBtn.textContent = '显示 MusicXML';
        }
    });

    function updateHistoryList() {
        historyList.innerHTML = '';
        conversionHistory.forEach((item, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${item.timestamp}</span>
                <div class="history-buttons">
                    <button class="select-history" data-index="${index}">选择</button>
                    <button class="play-history" data-index="${index}">播放</button>
                </div>
            `;
            historyList.appendChild(li);
        });

        // Add event listeners to new select buttons
        document.querySelectorAll('.select-history').forEach(button => {
            button.addEventListener('click', (e) => {
                const index = e.target.getAttribute('data-index');
                selectHistoryItem(index);
            });
        });

        // Add event listeners to new play buttons
        document.querySelectorAll('.play-history').forEach(button => {
            button.addEventListener('click', async (e) => {
                try {
                    await ensureAudioContext();
                    const index = e.target.getAttribute('data-index');
                    playMidi(conversionHistory[index].outputMidi, 'output');
                } catch (error) {
                    console.error('Error playing history item:', error);
                    alert('无法播放历史记录项，请稍后再试。');
                }
            });
        });

        // Make sure the history pane is visible
        historyPane.style.display = 'block';
    }

    async function selectHistoryItem(index) {
        // Remove highlight from all items
        document.querySelectorAll('#history-list li').forEach(item => {
            item.classList.remove('selected');
        });

        // Highlight the selected item
        document.querySelectorAll('#history-list li')[index].classList.add('selected');

        const item = conversionHistory[index];
        inputMidiUrl = item.inputMidi;
        outputMidiUrl = item.outputMidi;
        outputXmlUrl = item.outputXml;

        // Update the scoresheet
        try {
            const xmlResponse = await fetch(`/get_file/${encodeURIComponent(outputXmlUrl)}`);
            const xmlContent = await xmlResponse.text();
            await displayMusicXML(xmlContent);
        } catch (error) {
            console.error('Error loading MusicXML:', error);
            alert('无法加载乐谱，请稍后再试。');
        }

        // Update the MusicXML display
        try {
            const xmlResponse = await fetch(`/get_file/${encodeURIComponent(outputXmlUrl)}`);
            const xmlContent = await xmlResponse.text();
            xmlOutputDiv.innerHTML = `<pre>${escapeHtml(xmlContent)}</pre>`;
        } catch (error) {
            console.error('Error loading MusicXML:', error);
            alert('无法加载MusicXML，请稍后再试。');
        }

        // Update UI
        resultDiv.innerHTML = '已选择历史记录项。您现在可以播放原始乐谱和无伴奏合唱版本。';
        player.style.display = 'block';
        playInputBtn.disabled = false;
        playOutputBtn.disabled = false;
    }

    playInputBtn.addEventListener('click', async () => {
        if (originalFile && !conversionHappened) {
            await handleOriginalFile(originalFile);
        } else if (inputMidiUrl) {
            await playMidi(inputMidiUrl, 'input');
        } else {
            alert('请先上传文件或进行转换。');
        }
    });

    playOutputBtn.addEventListener('click', async () => {
        if (conversionHappened && outputMidiUrl) {
            await playMidi(outputMidiUrl, 'output');
        } else {
            alert('请先进行转换。');
        }
    });

    stopInputBtn.addEventListener('click', () => stopPlayback('input'));
    stopOutputBtn.addEventListener('click', () => stopPlayback('output'));

    async function playMidi(url, type) {
        if (!url) {
            console.error('MIDI URL is undefined');
            alert('MIDI 文件未找到，请先转换乐谱。');
            return;
        }

        try {
            await ensureAudioContext();

            if (isPlaying) {
                stopPlayback(type === 'input' ? 'output' : 'input');
            }

            console.log(`Attempting to fetch MIDI from: ${url}`);
            const response = await fetch(`/get_file/${encodeURIComponent(url)}`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            console.log(`MIDI file fetched, size: ${arrayBuffer.byteLength} bytes`);
            
            const midi = new Midi(arrayBuffer);
            console.log('MIDI parsed successfully');

            const now = Tone.now() + 0.5;
            currentSynth = new Tone.PolySynth(Tone.Synth, {
                envelope: {
                    attack: 0.02,
                    decay: 0.1,
                    sustain: 0.3,
                    release: 0.9
                }
            }).toDestination();

            midi.tracks.forEach(track => {
                track.notes.forEach(note => {
                    currentSynth.triggerAttackRelease(
                        note.name,
                        note.duration,
                        note.time + now,
                        note.velocity
                    );
                });
            });

            isPlaying = true;
            if (type === 'input') {
                stopInputBtn.style.display = 'inline-block';
                playInputBtn.style.display = 'none';
                playOutputBtn.disabled = true;
            } else {
                stopOutputBtn.style.display = 'inline-block';
                playOutputBtn.style.display = 'none';
                playInputBtn.disabled = true;
            }
            console.log('MIDI playback started');
        } catch (error) {
            console.error('Error playing MIDI:', error);
            alert('无法播放MIDI文件，请稍后再试。');
        }
    }

    function stopPlayback(type) {
        if (currentSynth) {
            currentSynth.dispose();
            currentSynth = null;
        }
        isPlaying = false;
        if (type === 'input') {
            stopInputBtn.style.display = 'none';
            playInputBtn.style.display = 'inline-block';
        } else {
            stopOutputBtn.style.display = 'none';
            playOutputBtn.style.display = 'inline-block';
        }
        playInputBtn.disabled = false;
        playOutputBtn.disabled = false;
        console.log('MIDI playback stopped');
    }

    async function handleOriginalFile(file) {
        if (file.type === 'audio/midi' || file.name.toLowerCase().endsWith('.mid')) {
            await playOriginalFile(file);
        } else {
            // If the file is not a MIDI, we need to convert it first
            await convertAndPlayOriginalFile(file);
        }
    }

    async function convertAndPlayOriginalFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/convert_to_midi', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to convert file to MIDI');
            }

            const data = await response.json();
            inputMidiUrl = data.midi_url;
            await playMidi(inputMidiUrl, 'input');
        } catch (error) {
            console.error('Error converting file to MIDI:', error);
            alert('无法将文件转换为MIDI格式，请稍后再试。错误: ' + error.message);
        }
    }

    async function playOriginalFile(file) {
        const arrayBuffer = await file.arrayBuffer();
        const midi = new Midi(arrayBuffer);
        console.log('Original MIDI parsed successfully');

        const now = Tone.now() + 0.5;
        currentSynth = new Tone.PolySynth(Tone.Synth, {
            envelope: {
                attack: 0.02,
                decay: 0.1,
                sustain: 0.3,
                release: 0.9
            }
        }).toDestination();

        midi.tracks.forEach(track => {
            track.notes.forEach(note => {
                currentSynth.triggerAttackRelease(
                    note.name,
                    note.duration,
                    note.time + now,
                    note.velocity
                );
            });
        });

        isPlaying = true;
        stopInputBtn.style.display = 'inline-block';
        playInputBtn.style.display = 'none';
        playOutputBtn.disabled = true;
        console.log('Original MIDI playback started');
    }

    async function ensureAudioContext() {
        if (!audioContext) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                await Tone.start();
                console.log('Audio context is ready');
            } catch (err) {
                console.error('Failed to start audio context:', err);
                throw err;
            }
        }
    }

    function escapeHtml(unsafe) {
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }
});