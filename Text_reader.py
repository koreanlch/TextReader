# 필요한 라이브러리 다운로드 ---------------------------------------------------------------------------------------
import os, threading, time, webbrowser, requests, json
from murf import Murf
from flask import Flask, request, send_file, jsonify
from io import BytesIO
from dotenv import load_dotenv
from werkzeug.utils import secure_filename
# 클라이언트(js)에서 요청을 받아서 처리 하는 함수 ----------------------------------------------------------------------
app = Flask(__name__, static_folder='static', static_url_path='')   # Flask 앱 초기화

@app.route('/')                                                     # 첫 접속시 최근 요청시간 설정 및 html 반환
def index():
    global last_request_time
    last_request_time = time.time()
    return app.send_static_file('index.html')

@app.route('/heartbeat', methods=['POST'])                          # 최근 요청시간 갱신, "alive"와 성공신호 반환
def heartbeat():
    global last_request_time
    last_request_time = time.time()
    return 'alive', 200

@app.route('/api/upload', methods=['POST'])                         # 파일 업로드시 "UPLOAD_FOLDER"에 저장하고 성공여부 반환
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400
    file = request.files['file']
    if not file or not file.filename:
        return jsonify({'error': 'No file chosen'}), 400

    filename = secure_filename(file.filename)
    path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(path)
    return jsonify({'message': 'Uploaded', 'filename': filename}), 200

@app.route('/api/filter', methods=['POST'])                         # 드롭다운 선택 시마다 선택지를 전송받아 나머지 드롭다운 필터링
def filter_options():
    data = request.get_json()
    lang   = data.get('language', '')
    gender = data.get('gender', '')
    age    = data.get('age', '')
    style  = data.get('style', '')
    voice_id = data.get('voice_id', '')

    # voice_list 항목: [id, [languages], gender, age, [styles]]
    filtered = [
        v for v in voice_ids
        if ((not lang)   or lang   == 'All' or lang   in v[1])
        and ((not gender) or gender == 'All' or gender == v[2])
        and ((not age)    or age    == 'All' or age    == v[3])
    ]

    # voice_id가 있으면 해당 보이스만 남김 (스타일로 필터링하지 않음)
    if voice_id:
        filtered = [v for v in filtered if v[0] == voice_id]

    # 각 드롭다운별 허용될 값 추출
    allowed = {
        'language': sorted({l for v in filtered for l in v[1]}),
        'gender':   sorted({v[2] for v in filtered}),
        'age':      sorted({v[3] for v in filtered}),
        'style':    sorted({s for v in filtered for s in v[4]})
    }
    # count 추가, 남은 보이스 개수
    response = {**allowed, 'count' : len(filtered), 'voice_ids' : [v[0] for v in filtered]}
    return jsonify(response)

@app.route('/api/synthesize', methods=['POST'])                     # 파라미터를 전송받아 murf에 합성 요청, 오디오 반환
def synthesize():
    global last_request_time
    last_request_time = time.time()

    data = request.get_json()
    text = data.get('text', '').strip()
    selected_voice_id = data.get('voice_id','').strip()
    style_selected   = data.get('style', '').strip()
    requested_locale = data.get('lang','').strip()
    speed = int(data.get('speed',''))
    pitch = int(data.get('pitch',''))
    format = data.get('format','').strip()

    # 클라이언트 초기화
    client = Murf(api_key=MURF_API_KEY)
    # 요청 파라미터
    params = {
        "text": text,
        "voice_id": selected_voice_id,
        "style" : style_selected,
        "rate": speed,
        "pitch": pitch,        
        "format": format,
        "sample_rate": 44100.0
    }
    # 다국어 지원 보이스 확인, 다국어 파라미터 지정
    for vid, langs, *_ in voice_ids:
        if vid == selected_voice_id and len(langs) > 1:
            params["multi_native_locale"] = requested_locale
            break
    print("[SYNTHESIZE PARAMS]", params)
    try: # 파라미터로 음성 변환하여 반환
        tts_resp = client.text_to_speech.generate(**params)
        audio_url = tts_resp.audio_file
        audio_resp = requests.get(audio_url)
        audio_stream = BytesIO(audio_resp.content)
        return send_file(
            audio_stream,
            mimetype='audio/mpeg',
            as_attachment=False
        )
    except Exception as e:
        return jsonify({'error': f'Error during converting: {e}'}), 500

# 클라이언트 요청 없이 브라우저 동작 관련 함수 ------------------------------------------------------------------------
def open_browser():                                                 # 1.5초 후 브라우저 접속
    time.sleep(1.5)
    webbrowser.open('http://127.0.0.1:5000')

def monitor_browser():                                              # 브라우저 상태를 확인하여 프로그램 종료
    global last_request_time
    while True:
        time.sleep(1)
        if time.time() - last_request_time > 10:  # 10초 동안 heartbeat가 없으면
            print("브라우저가 닫혀서 서버를 종료합니다.")
            os._exit(0)  # Text_reader.py 완전 종료

#----------------------------------------------------------------------------------------------------------------
# 서버 감시용 변수
last_request_time = time.time()  # 마지막 요청 시간 : 현재시간

# 환경변수로부터 API 키 받아오기 
dotenv_path = os.path.join(os.path.dirname(__file__), 'static', '.env')
load_dotenv(dotenv_path)
MURF_API_KEY = os.getenv("MURF_API_KEY")
print("Loaded MURF_API_KEY:", MURF_API_KEY)

# [voice_id, [languages], gender, age, [styles]] 배열이 있는 voices.json 파일 열어서 voice_ids 리스트로 저장
with open('voices.json', encoding='utf-8') as f:
    voice_ids = json.load(f)
    
# 업로드된 파일 저장 폴더 설정
UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

if __name__ == '__main__':
    threading.Thread(target=monitor_browser, daemon=True).start()
    threading.Thread(target=open_browser, daemon=True).start()  # 이 줄 추가!
    app.run(host='127.0.0.1', port=5000, use_reloader=False, threaded=True)

#  pip install flask python-dotenv requests werkzeug murf
## pyinstaller --onefile --noconsole --add-data "static;static" Text_reader.py
