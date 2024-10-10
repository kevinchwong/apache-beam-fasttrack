let osmd;
let player;
let isScoreLoaded = false;

async function initializeAudio() {
    await Tone.start();
    console.log('音频上下文已初始化');
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('upload-form');
    const resultDiv = document.getElementById('result');
    const playInputBtn = document.getElementById('play-input');
    const playOutputBtn = document.getElementById('play-output');


    document.getElementById('music-sheet').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            loadAndRenderMusicXML(file);
        }
    });
    
    document.getElementById('play-input').addEventListener('click', async function() {
        await initializeAudio();
        playMusic();
    });

    document.getElementById('play-output').addEventListener('click', async function() {
        await initializeAudio();
        playMusic();
    });

    let inputMidiUrl, outputMidiUrl;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);

        try {
            const response = await fetch('/convert', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('转换失败');
            }

            const data = await response.json();
            inputMidiUrl = `/get_file/${encodeURIComponent(data.input_midi)}`;
            outputMidiUrl = `/get_file/${encodeURIComponent(data.output_midi)}`;

            resultDiv.innerHTML = '转换成功！您现在可以播放输入和输出的乐谱。';
            playInputBtn.disabled = false;
            playOutputBtn.disabled = false;
        } catch (error) {
            resultDiv.innerHTML = `错误: ${error.message}`;
        }
    });

    playInputBtn.addEventListener('click', () => playMidi(inputMidiUrl));
    playOutputBtn.addEventListener('click', () => playMidi(outputMidiUrl));

    function playMidi(url) {
        MIDI.loadPlugin({
            soundfontUrl: "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/",
            instrument: "acoustic_grand_piano",
            onprogress: function(state, progress) {
                console.log(state, progress);
            },
            onsuccess: function() {
                MIDI.Player.loadFile(url, function() {
                    MIDI.Player.start();
                });
            }
        });
    }
    
    function loadAndRenderMusicXML(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const xmlContent = e.target.result;
            
            if (!osmd) {
                osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay("music-container", {
                    autoResize: true,
                    drawTitle: true,
                });
            }
            
            osmd.load(xmlContent)
                .then(() => {
                    osmd.render();
                    isScoreLoaded = true;
                    console.log('MusicXML已加载并渲染');
                })
                .catch(error => {
                    console.error('加载MusicXML时出错:', error);
                });
        };
        reader.readAsText(file);
    }   

    async function playMusic() {
        if (!isScoreLoaded) {
            console.error('请先加载MusicXML文件');
            return;
        }
    
        if (!player) {
            player = new OSMD.PlayerAsync(osmd);
            await player.loadScore();
        }
    
        try {
            await player.play();
            console.log('开始播放音乐');
        } catch (error) {
            console.error('播放音乐时出错:', error);
        }
    }

});