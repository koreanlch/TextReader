# 필요한 라이브러리 다운로드 ---------------------------------------------------------------------------------------
import os,  requests, json
from murf import Murf
from flask import Flask, request, send_file, jsonify, render_template_string
from io import BytesIO
from dotenv import load_dotenv
from gtts import gTTS
import uuid

app = Flask(__name__, static_folder='static', static_url_path='')   # Flask 앱 초기화

@app.route('/')                                                     # 첫 접속시 html 반환
def index():
    return app.send_static_file('index.html')

@app.route('/api/filter', methods=['POST'])                         # 드롭다운 선택 시마다 선택지를 전송받아 나머지 드롭다운 필터링
def filter_options():
    data = request.get_json()
    lang   = data.get('language', '')
    gender = data.get('gender', '')
    age    = data.get('age', '')
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

@app.route('/tts', methods=['POST'])
def tts():
    text = request.form.get('text')
    if not text:
        return {'error': '텍스트를 입력해주세요.'}, 400
    tts = gTTS(text, lang='ko')
    filename = f"tts_{uuid.uuid4().hex}.mp3"
    filepath = os.path.join('static', filename)
    tts.save(filepath)
    return {'audio_url': f'/static/{filename}'}

#----------------------------------------------------------------------------------------------------------------

# 환경변수로부터 API 키 받아오기 
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path)
MURF_API_KEY = os.getenv("MURF_API_KEY")
print("Loaded MURF_API_KEY:", MURF_API_KEY)

# [voice_id, [languages], gender, age, [styles]] 배열이 있는 voices.json 파일 열어서 voice_ids 리스트로 저장
with open(os.path.join('static', 'voices.json'), encoding='utf-8') as f:
    voice_ids = json.load(f)
    

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=9002, use_reloader=False, threaded=True)

#  pip install flask python-dotenv requests murf
## pyinstaller --onefile --noconsole --add-data "static;static" Text_reader.py