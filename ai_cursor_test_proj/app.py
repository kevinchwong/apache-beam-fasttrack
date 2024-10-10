import logging
import json
import tempfile
import threading
import time
from flask import Flask, request, jsonify, send_file, render_template, Response
from music21 import converter, harmony, midi
from urllib.parse import unquote
import ai_arranger
import os
import traceback

logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 限制上传文件大小为 16MB
app.config['JSON_AS_ASCII'] = False

# 在应用启动时检查模型
model_path = os.path.join(os.path.dirname(__file__), 'acapella_model.keras')
if not os.path.exists(model_path):
    logging.error(f"Model file not found: {model_path}")
elif ai_arranger.arranger is None or ai_arranger.arranger.model is None:
    logging.error("AI model not initialized properly")
else:
    logging.info("AI model initialized successfully")

def ensure_dir(file_path):
    directory = os.path.dirname(file_path)
    if not os.path.exists(directory):
        os.makedirs(directory)
        logging.info(f"Created directory: {directory}")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/convert', methods=['POST'])
def convert_to_acapella():
    logging.info("Starting conversion process")
    logging.debug(f"Request method: {request.method}")
    logging.debug(f"Request content type: {request.content_type}")
    logging.debug(f"Request files: {request.files}")
    logging.debug(f"Request form: {request.form}")
    
    if 'file' not in request.files:
        logging.error("No file part in the request")
        return jsonify({'error': '没有上传文件'}), 400
    
    file = request.files['file']
    logging.info(f"Received file: {file.filename}")
    
    if file.filename == '':
        logging.error("No selected file")
        return jsonify({'error': '没有选择文件'}), 400

    if not file or not allowed_file(file.filename):
        logging.error(f"Invalid file: {file.filename}")
        return jsonify({'error': '不支持的文件类型'}), 400

    file_content = file.read()
    logging.info(f"File content length: {len(file_content)} bytes")

    voices = int(request.form.get('voices', 4))
    style = request.form.get('style', 'classical')

    logging.info(f"Conversion parameters - Voices: {voices}, Style: {style}")

    def generate():
        total_steps = 100
        for i in range(total_steps):
            time.sleep(0.1)
            progress = (i + 1) / total_steps * 100
            logging.info(f"Conversion progress: {progress:.2f}%")
            yield f"data: {json.dumps({'progress': progress})}\n\n"

        try:
            logging.info("Parsing score")
            score = converter.parse(file_content)
            logging.info("Score parsed successfully")

            logging.info("Analyzing harmony")
            chords = harmony.realizeChordSymbolDurations(score)
            logging.info("Harmony analysis completed")

            logging.info("Arranging score")
            acapella_score = ai_arranger.arrange(score, chords, voices=voices, style=style)
            logging.info("Score arrangement completed")
            
            logging.info("Creating temporary files")
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mid') as input_midi_file, \
                 tempfile.NamedTemporaryFile(delete=False, suffix='.mid') as output_midi_file, \
                 tempfile.NamedTemporaryFile(delete=False, suffix='.xml') as output_xml_file:
                
                ensure_dir(input_midi_file.name)
                ensure_dir(output_midi_file.name)
                ensure_dir(output_xml_file.name)
                
                logging.info("Writing input MIDI file")
                score.write('midi', input_midi_file.name)
                logging.info(f"Input MIDI file written: {input_midi_file.name}")

                logging.info("Writing output MIDI file")
                acapella_score.write('midi', output_midi_file.name)
                logging.info(f"Output MIDI file written: {output_midi_file.name}")

                logging.info("Writing output XML file")
                acapella_score.write('musicxml', output_xml_file.name)
                logging.info(f"Output XML file written: {output_xml_file.name}")

                result = {
                    'input_midi': input_midi_file.name,
                    'output_midi': output_midi_file.name,
                    'output_xml': output_xml_file.name
                }
            
            logging.info(f"Generated files: {result}")
            
            for file_path in result.values():
                delayed_file_cleanup(file_path, delay=3600)

            logging.info("Conversion completed successfully")
            yield f"data: {json.dumps(result)}\n\n"
        except Exception as e:
            logging.error(f"Error in conversion: {str(e)}")
            logging.error(traceback.format_exc())
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(generate(), mimetype='text/event-stream')

@app.route('/get_file/<path:filename>')
def get_file(filename):
    filename = unquote(filename)
    
    # Check if the filename starts with the current working directory
    cwd = os.getcwd()
    if filename.startswith(cwd):
        filename = filename[len(cwd):].lstrip('/')
    
    # Check if the file exists in the root directory
    if os.path.exists(f"/{filename}"):
        absolute_path = f"/{filename}"
    else:
        absolute_path = os.path.abspath(filename)
    
    logging.info(f"Requested file: {absolute_path}")
    logging.debug(f"Current working directory: {os.getcwd()}")
    logging.debug(f"File exists: {os.path.exists(absolute_path)}")
    
    if not os.path.exists(absolute_path):
        logging.error(f"File not found: {absolute_path}")
        return jsonify({'error': f'File not found: {absolute_path}'}), 404
    
    try:
        if filename.lower().endswith('.mid'):
            mime_type = 'audio/midi'
        elif filename.lower().endswith('.xml'):
            mime_type = 'application/xml'
        else:
            mime_type = 'application/octet-stream'
        
        logging.info(f"Sending file: {absolute_path}")
        return send_file(absolute_path, mimetype=mime_type, as_attachment=True)
    except Exception as e:
        logging.error(f"Error sending file: {str(e)}")
        logging.error(traceback.format_exc())
        return jsonify({'error': f'Error sending file: {str(e)}'}), 500

def delayed_file_cleanup(filename, delay=3600):  # Keep files for 1 hour
    def cleanup():
        time.sleep(delay)
        absolute_path = os.path.abspath(filename)
        if os.path.exists(absolute_path):
            try:
                os.remove(absolute_path)
                logging.info(f"Deleted file: {absolute_path}")
            except Exception as e:
                logging.error(f"Error deleting file {absolute_path}: {str(e)}")
        else:
            logging.warning(f"File not found for deletion: {absolute_path}")
    
    threading.Thread(target=cleanup).start()

@app.after_request
def cleanup(response):
    for key in ['input_midi', 'output_midi', 'output_xml']:
        filename = request.args.get(key)
        if filename and os.path.exists(filename):
            delayed_file_cleanup(filename)
    return response

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in {'mscz', 'musicxml', 'xml', 'mid', 'midi'}

@app.route('/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'),
                               'favicon.ico', mimetype='image/vnd.microsoft.icon')

@app.route('/convert_to_midi', methods=['POST'])
def convert_to_midi():
    if 'file' not in request.files:
        return jsonify({'error': '没有上传文件'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': '没有选择文件'}), 400

    if not file or not allowed_file(file.filename):
        return jsonify({'error': '不支持的文件类型'}), 400

    try:
        # 保存上传的文件到临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
            file.save(temp_file.name)
            logging.info(f"Temporary file saved: {temp_file.name}")

        # 解析保存的文件
        logging.info(f"Attempting to parse file: {temp_file.name}")
        score = converter.parse(temp_file.name)
        logging.info("File parsed successfully")

        # 创建临时 MIDI 文件
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mid') as temp_midi_file:
            logging.info(f"Writing MIDI to temporary file: {temp_midi_file.name}")
            score.write('midi', temp_midi_file.name)
            logging.info("MIDI file written successfully")

        midi_url = temp_midi_file.name
        
        # 安排文件清理
        delayed_file_cleanup(midi_url, delay=3600)
        delayed_file_cleanup(temp_file.name, delay=3600)

        logging.info(f"Conversion successful. MIDI URL: {midi_url}")
        return jsonify({'midi_url': midi_url})
    except Exception as e:
        logging.error(f"Error converting file to MIDI: {str(e)}")
        logging.error(traceback.format_exc())
        return jsonify({'error': f'文件转换失败: {str(e)}'}), 500

if __name__ == '__main__':
    logging.info("Starting the application")
    app.run(debug=True, port=5002)