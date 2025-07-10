// script.js
// 전역 변수 선언부 ---------------------------------------------------------------------------------------------------
const elements = {
    textInput:          document.getElementById('textInput'),                   // 입력된 텍스트
    modifyBtn:          document.getElementById('modifyBtn'),                   // 수정 버튼
    convertBtn:         document.getElementById('convertBtn'),                  // 변환 버튼
    btnText:            document.querySelector ('.btn-text'),                   // 변환 전 버튼 텍스트
    loading:            document.querySelector ('.loading'),                    // 변환 중 버튼 텍스트
    audioPlayer:        document.getElementById('audioPlayer'),                 // 오디오 플레이어
    playPauseBtn:       document.getElementById('playPauseBtn'),                // 재생버튼
    uploadBtn:          document.getElementById('uploadBtn'),                   // 업로드 버튼
    fileInput:          document.getElementById('fileInput'),                   // 업로드된 파일
    downloadBtn:        document.getElementById('downloadBtn'),                 // 다운로드 버튼
    progressBar:        document.getElementById('progressBar'),                 // 진행률 바
    progressContainer:  document.getElementById('progressContainer'),           // 전체 진행 컨테이너
    timeDisplay:        document.getElementById('timeDisplay'),                 // 현재 경과 시간 / 전체시간 표시
    volumeBtn:          document.getElementById('volumeBtn'),                   // 볼륨 버튼
    volumeSlider:       document.getElementById('volume-slider'),               // 볼륨 슬라이더
    status:             document.getElementById('status'),                      // 현재 상태
    language:           document.getElementById('language'),                    // 언어 선택지
    gender:             document.getElementById('gender'),                      // 성별 선택지
    age:                document.getElementById('age'),                         // 나이 선택지
    style:              document.getElementById('style'),                       // 스타일 선택지
    number:             document.getElementById('Number'),                      // 보이스 번호 선택지
    format :            document.getElementById('format'),                      // 다운로드 파일 포맷
    speedRange:         document.getElementById('speed-range'),                 // 속도 슬라이더 값
    speedInput:         document.getElementById('speed-input'),                 // 속도 입력값
    pitchRange:         document.getElementById('pitch-range'),                 // 피치 슬라이더 값
    pitchInput:         document.getElementById('pitch-input'),                 // 피치 입력값
    formatLabel:        document.querySelector ('label[for="format"]')          // 포맷 레이블
};
const langSel               = elements.language;
const genSel                = elements.gender;
const ageSel                = elements.age;
const styleSel              = elements.style;
const numberSel             = elements.number;
const speedRange            = elements.speedRange;
const speedInput            = elements.speedInput;
const pitchRange            = elements.pitchRange;
const pitchInput            = elements.pitchInput;
let filteredVoices          = []            // 필터링 된 보이스 목록
let currentAudioBlob        = null;         // 오디오 파일의 데이터
let currentAudioUrl         = null;         // 임시 오디오 Url (재생 및 다운로드에 필요)
let isConverted             = false;        // 변환된 상태인지
let isConverting            = false;        // 변환중인 상태인지
let progressUpdateInterval  = null;         // 진행 바 작동상태

// 함수 선언부 --------------------------------------------------------------------------------------------------------
// 상태 확인 함수들, T/F로 반환 
function isLanguageSelected(){ // 언어 드롭다운이 선택되었는지? T/F
    const v =elements.language.value;
    return (v !=='' && v !== 'All')
}
function isGenderSelected(){   // 성별 드롭다운이 선택되었는지? T/F
    const v =elements.gender.value;
    return (v !=='' && v !== 'All')
}
function isAgeSelected(){      // 나이 드롭다운이 선택되었는지? T/F
    const v =elements.age.value;
    return (v !=='' && v !== 'All')
}
// 잠금 처리/해제
function lockgOthers(lock) {   // 성별, 나이, 스타일 잠글건지?
    ['gender','age','style'].forEach(key => {
      const sel = elements[key];
      if (lock) {
        sel.classList.add('locked');
      } else {
        sel.classList.remove('locked');
      }
    });
}
function lockaOthers(lock) {   // 나이, 스타일 잠글건지?
    ['age','style'].forEach(key => {
      const sel = elements[key];
      if (lock) {
        sel.classList.add('locked');
      } else {
        sel.classList.remove('locked');
      }
    });
}
function locksOthers(lock) {   // 스타일 잠글건지?
    ['style'].forEach(key => {
      const sel = elements[key];
      if (lock) {
        sel.classList.add('locked');
      } else {
        sel.classList.remove('locked');
      }
    });
}
function lockNumber(lock){     // 보이스 번호 선택 잠글건지?
    if(lock){
        numberSel.classList.add('locked');
    } else {
        numberSel.classList.remove('locked');
    } 
}
function setTextLocked(lock) { // 텍스트 입력 잠글건지?
    if (lock) {
        elements.textInput.disabled = true;
        elements.modifyBtn.style.display = 'block';
    } else {
        elements.textInput.disabled = false;
        elements.modifyBtn.style.display = 'none';
    }
}

// 드롭다운 선택지 관리
async function fetchAllowed({ language='', gender='', age='', style='' }) { // 선택결과를 서버에 전송, 필터링된 결과를 반환
  const res = await fetch('/api/filter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language, gender, age, style })
  });
  if (!res.ok) throw new Error('Fail to request filtering');
  const data = await res.json();
  filteredVoices = data.voice_ids || [];
  return data;
}
function applyOptions(sel, allowed) {
    // 비교를 위해 모두 소문자+trim 처리
    const allowedNorm = allowed.map(v => v.trim().toLowerCase());
    // 1. 옵션 숨김/표시 처리
    Array.from(sel.options).forEach(opt => {
        const optNorm = opt.value.trim().toLowerCase();
        if (opt.value === 'All' || allowedNorm.includes(optNorm)) {
            opt.hidden = false;
        } else {
            opt.hidden = true;
        }
    });

    // 2. All을 제외한 실제 표시 옵션 개수 세기
    const visibleOptions = Array.from(sel.options)
        .filter(opt => !opt.hidden && opt.value !== 'All');

    if (visibleOptions.length === 1) {
        // All 숨기기
        Array.from(sel.options).forEach(opt => {
            if (opt.value === 'All') opt.hidden = true;
        });
        // 1개 남은 값으로 자동 선택 + change 이벤트 발생 (공백/대소문자 무시)
        sel.value = visibleOptions[0].value;
        sel.dispatchEvent(new Event('change'));
    }
}
function updateNumberOptions(voiceList) {
    numberSel.innerHTML = '';
    voiceList.forEach((vid, idx) => {
        const opt = document.createElement('option');
        opt.value = vid;
        opt.text  = idx + 1;
        numberSel.appendChild(opt);
    });
    if (voiceList.length > 0) {
        numberSel.selectedIndex = 0; // 반드시 이 줄이 있어야 함!
        // numberSel.value = voiceList[0]; // 이 줄은 없어도 됨(선택지는 1,2,3,4니까)
        numberSel.dispatchEvent(new Event('change')); // 필요하다면
    }
}

// TTS 변환 관련
async function convertText() { // 텍스트 변환하기
    const text = elements.textInput.value.trim();
    if (!text) {
        showStatus('Enter text', 'error');
        elements.convertBtn.disabled = false; // 다시 활성화!
        return;
    }
    
    if (!isLanguageSelected()){
        showStatus('Select a language first','error');
        return;
    }
    elements.formatLabel.style.display = 'none';
    elements.format.style.display ='none';
    convertBtn.disabled = true;

    const selectedVoiceId = elements.number.value; // ← 여기만 수정!
    setConvertingState(true);
    showStatus('Converting to Audio...', 'info');

    try {
        const response = await fetch('/api/synthesize', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: text,
                lang:     elements.language.value,
                gender:   elements.gender.value,
                age:      elements.age.value,
                style:    elements.style.value,
                voice_id: selectedVoiceId,
                speed:    parseInt(elements.speedRange.value),
                pitch:    parseInt(elements.pitchRange.value),
                format:   format.value

            })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || err.errorMessage || 'Failed to convert');
        }

        currentAudioBlob = await response.blob();
        
        if (currentAudioUrl) {
            URL.revokeObjectURL(currentAudioUrl);
        }
        
        currentAudioUrl = URL.createObjectURL(currentAudioBlob);
        elements.audioPlayer.src = currentAudioUrl;
        elements.audioPlayer.load();
        await new Promise((resolve, reject) => {
            elements.audioPlayer.oncanplaythrough = resolve;
            elements.audioPlayer.onerror = reject;
        });
        
        isConverted = true;
        setConvertingState(false);
        setTextLocked(true);
        updateButtonState();
        // 변환 완료 후 볼륨 슬라이더/버튼 활성화
        elements.volumeSlider.disabled = false;
        elements.volumeBtn.disabled = false;
        elements.volumeSlider.style.pointerEvents = 'auto';
        elements.volumeSlider.style.opacity = '1';
        elements.volumeBtn.style.pointerEvents = 'auto';
        elements.volumeBtn.style.opacity = '1';

        elements.fileInput.addEventListener('change', async () => {
            const file = elements.fileInput.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('file', file);

            showStatus('Uploading...', 'info');
            try {
                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                if (!res.ok) throw new Error();
                const data = await res.json();
                showStatus(`Successfully Uploaded : ${data.filename}`, 'success');
            } catch (err) {
                console.error(err);
                showStatus('Failed to upload.', 'error');
            } finally {
                elements.fileInput.value = '';
            }
        });
        elements.progressContainer.style.pointerEvents = 'auto';
        elements.progressContainer.style.opacity = '1';

        ['playPauseBtn','volumeBtn'].forEach(id=>{
          const btn = document.getElementById(id);
          btn.style.pointerEvents = 'auto';
          btn.style.opacity = '1';
        });
        const totalTime = formatTime(elements.audioPlayer.duration);
        elements.timeDisplay.textContent = `0:00 / ${totalTime}`;
        
        showStatus('Converting finished!', 'success');

    } catch (error) {
        console.error('Converting Error:', error);
        showStatus('An error occured during Converting.', 'error');
        setConvertingState(false);
    }
}
function setConvertingState(converting) { // 변환 중 상태로 전환할건지?
    isConverting = converting;
    
    if (converting) {
        elements.convertBtn.disabled = true;
        elements.btnText.style.display = 'none';
        elements.loading.style.display = 'flex';

        elements.textInput.disabled = true;
        elements.modifyBtn.disabled = true;
        elements.language.disabled = true;
        elements.gender.disabled = true;
        elements.age.disabled = true;
        elements.style.disabled = true;
        elements.number.disabled = true;
        elements.speedRange.disabled =true;
        elements.speedInput.disabled =true;
        elements.pitchRange.disabled =true;
        elements.pitchInput.disabled =true;
        // 볼륨 슬라이더/버튼 비활성화
        elements.volumeSlider.disabled = true;
        elements.volumeBtn.disabled = true;
        elements.volumeSlider.style.pointerEvents = 'none';
        elements.volumeSlider.style.opacity = '0.5';
        elements.volumeBtn.style.pointerEvents = 'none';
        elements.volumeBtn.style.opacity = '0.5';
    } else {
        elements.convertBtn.disabled = false;
        elements.btnText.style.display = 'flex';
        elements.loading.style.display = 'none';
        
        elements.modifyBtn.disabled = false;
        elements.language.disabled = false;
        elements.gender.disabled = false;
        elements.age.disabled = false;
        elements.style.disabled = false;
        elements.number.disabled = false;
        elements.speedRange.disabled =false;
        elements.speedInput.disabled =false;
        elements.pitchRange.disabled =false;
        elements.pitchInput.disabled =false;
        // 볼륨 슬라이더/버튼 활성화 (변환 완료 후)
        elements.volumeSlider.disabled = false;
        elements.volumeBtn.disabled = false;
        elements.volumeSlider.style.pointerEvents = 'auto';
        elements.volumeSlider.style.opacity = '1';
        elements.volumeBtn.style.pointerEvents = 'auto';
        elements.volumeBtn.style.opacity = '1';
    }
}
function updateButtonState() { // 변환 <-> 다운로드 버튼 변경
    if (isConverted) {
        elements.convertBtn.style.display = 'none';
        elements.downloadBtn.style.display = 'inline-flex';
        elements.formatLabel.style.display = "inline-block";
        elements.format.style.display = "inline-block";
    } else {
        elements.convertBtn.style.display = 'inline-flex';
        elements.downloadBtn.style.display = 'none';
        elements.formatLabel.style.display = "none";
        elements.format.style.display = "none";
    }
}
function modifyText() {    // 텍스트 수정했을 떄
    // 변환 전으로 되돌리기(입력창 잠금 해제, 변환 버튼으로 변경)
    isConverted = false;
    setTextLocked(false);
    updateButtonState();
    // 오디오 일시정지, 오디오섹션 모두 잠금 및 반투명화 및 초기화
    elements.audioPlayer.pause();
    elements.progressContainer.style.pointerEvents = 'none';
    elements.progressContainer.style.opacity = '0.5';
    ['playPauseBtn','volumeBtn'].forEach(id => {
        const btn = document.getElementById(id);
        btn.style.pointerEvents = 'none';
        btn.style.opacity = '0.5';
    });
    if (currentAudioUrl) {
        URL.revokeObjectURL(currentAudioUrl);
        currentAudioUrl = null;
    }
    currentAudioBlob = null;
    if (progressUpdateInterval) {
        clearInterval(progressUpdateInterval);
        progressUpdateInterval = null;
    }
    // 텍스트 박스 포커싱 및 상태메시지 출력
    elements.textInput.focus();
    showStatus('You can edit text.', 'info');
}
function showStatus(message, type = 'info') {// 상태메시지 출력
    elements.status.textContent = message;
    elements.status.className = `status ${type}`;
    elements.status.style.display = 'block';
    
    setTimeout(() => {
        elements.status.style.display = 'none';
    }, 3000);
}

// 오디오 관련
function formatTime(seconds) { // 재생 시간 표시
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
function updateProgress() {    // 재생 바 길이 갱신
    if (elements.audioPlayer.duration) {
        const progress = (elements.audioPlayer.currentTime / elements.audioPlayer.duration) * 100;
        elements.progressBar.style.width = progress + '%';
        
        const currentTime = formatTime(elements.audioPlayer.currentTime);
        const totalTime = formatTime(elements.audioPlayer.duration);
        elements.timeDisplay.textContent = `${currentTime} / ${totalTime}`;
    }
}
function playAudio() {         // 오디오 재생
    if (currentAudioUrl) {
        elements.audioPlayer.currentTime = 0;
        elements.audioPlayer.play();
        elements.playPauseBtn.textContent = '⏸';
        progressUpdateInterval = setInterval(updateProgress, 100);
    }
}
function pauseAudio() {        // 오디오 일시정지
    elements.audioPlayer.pause();
    elements.playPauseBtn.textContent = '▶';
    
    if (progressUpdateInterval) {
        clearInterval(progressUpdateInterval);
        progressUpdateInterval = null;
    }
}
function downloadAudio() {     // 오디오 다운로드
    if (currentAudioBlob) {
        const fmt = elements.format.value.toLowerCase();
        const filename = `tts_audio.${fmt}`;
        const a = document.createElement('a');
        a.href = currentAudioUrl;
        a.download = filename;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showStatus('Download has started', 'success');
    }
}

// -------------------------------------------------------------------------------------------------------------------

// 이벤트 리스너 ----------------------------------------------------------------------------------------------------
// 각 드롭다운 갱신 이벤트
langSel.addEventListener('change', async () => {
  const { gender, age, style, voice_ids } = await fetchAllowed({ language: langSel.value });
  applyOptions(genSel, gender);
  applyOptions(ageSel, age);
  updateNumberOptions(voice_ids);
  // style은 넘버 change에서 자동으로 바뀜

  // 값은 'All'로만 초기화, change 이벤트 트리거하지 않음
  // 성별
  if (gender.length === 1) {
      genSel.value = gender[0];
      genSel.dispatchEvent(new Event('change'));
  } else {
      genSel.value = 'All';
  }
  // 나이
  if (age.length === 1) {
      ageSel.value = age[0];
      ageSel.dispatchEvent(new Event('change'));
  } else {
      ageSel.value = 'All';
  }
  // style도 All로 초기화
  elements.style.innerHTML = '';
  const styleAllOpt = document.createElement('option');
  styleAllOpt.value = 'All';
  styleAllOpt.text = 'All';
  elements.style.appendChild(styleAllOpt);
  elements.style.value = 'All';
});
genSel.addEventListener('change', async () => {
  const language = langSel.value;
  const gender   = genSel.value;
  const { age, voice_ids } = await fetchAllowed({ language, gender });
  applyOptions(ageSel, age);
  updateNumberOptions(voice_ids);
  // style은 넘버 change에서 자동으로 바뀜
  // 나이
  if (age.length === 1) {
      ageSel.value = age[0];
      ageSel.dispatchEvent(new Event('change'));
  } else {
      ageSel.value = 'All';
  }
  // style도 All로 초기화
  elements.style.innerHTML = '';
  const styleAllOpt2 = document.createElement('option');
  styleAllOpt2.value = 'All';
  styleAllOpt2.text = 'All';
  elements.style.appendChild(styleAllOpt2);
  elements.style.value = 'All';
});
ageSel.addEventListener('change', async () => {
  const language = langSel.value;
  const gender   = genSel.value;
  const age      = ageSel.value;
  const { voice_ids } = await fetchAllowed({ language, gender, age });
  updateNumberOptions(voice_ids);
  // style은 넘버 change에서 자동으로 바뀜

  // style도 All로 초기화
  elements.style.innerHTML = '';
  const styleAllOpt2 = document.createElement('option');
  styleAllOpt2.value = 'All';
  styleAllOpt2.text = 'All';
  elements.style.appendChild(styleAllOpt2);
  elements.style.value = 'All';

  // 만약 언어, 성별, 나이가 모두 'All'이 아니고, 보이스가 하나 이상 있으면
  if (language !== 'All' && gender !== 'All' && age !== 'All' && voice_ids.length > 0) {
    // 첫 번째 보이스의 스타일을 서버에서 받아와서 style 드롭다운을 채움
    const selectedVoiceId = voice_ids[0];
    const res = await fetch('/api/filter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, gender, age, voice_id: selectedVoiceId })
    });
    const data = await res.json();
    const allowedStyles = data.style || [];
    if (allowedStyles.length > 0) {
      elements.style.innerHTML = '';
      allowedStyles.forEach(style => {
        const opt = document.createElement('option');
        opt.value = style;
        opt.text = style;
        elements.style.appendChild(opt);
      });
      // Conversational이 있으면 그것으로, 없으면 첫 번째 스타일로
      const preferred = allowedStyles.includes('Conversational') ? 'Conversational' : allowedStyles[0];
      elements.style.value = preferred;
      elements.style.dispatchEvent(new Event('change'));
    }
  }
});
numberSel.addEventListener('change', async () => {
    const language = langSel.value;
    const gender = genSel.value;
    const age = ageSel.value;
    const numIdx = numberSel.selectedIndex;
    const selectedVoiceId = filteredVoices[numIdx];

    if (!selectedVoiceId) return;

    const res = await fetch('/api/filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, gender, age, voice_id: selectedVoiceId })
    });
    const data = await res.json();
    const allowedStyles = data.style || [];

    elements.style.innerHTML = '';
    if (allowedStyles.length > 0) {
        allowedStyles.forEach(style => {
            const opt = document.createElement('option');
            opt.value = style;
            opt.text = style;
            elements.style.appendChild(opt);
        });
        const preferred = allowedStyles.includes('Conversational') ? 'Conversational' : allowedStyles[0];
        elements.style.value = preferred;
        elements.style.dispatchEvent(new Event('change'));
    } else {
        const styleAllOpt = document.createElement('option');
        styleAllOpt.value = 'All';
        styleAllOpt.text = 'All';
        elements.style.appendChild(styleAllOpt);
        elements.style.value = 'All';
    }
});
styleSel.addEventListener('change', () => {
    isConverted = false;
    updateButtonState();
});
// 슬라이더를 움직이면 숫자도 바뀌게
speedRange.addEventListener('input',()=>{
    const v = parseInt(speedRange.value);
    speedInput.value = v;
    isConverted=false;
    updateButtonState();
});
pitchRange.addEventListener('input',()=>{
    const p = parseInt(pitchRange.value);
    pitchInput.value = p;
    isConverted=false;
    updateButtonState();
});
// 숫자를 입력하면 슬라이더도 바뀌게
speedInput.addEventListener('input', () => {
    let v = parseFloat(speedInput.value);
    if (isNaN(v)) v=0;
    v = Math.min(Math.max(v, parseFloat(speedRange.min)), parseFloat(speedRange.max));
    speedInput.value = v;
    speedRange.value = v;
    isConverted=false;
    updateButtonState();
});
pitchInput.addEventListener('input', () => {
    let p = parseInt(pitchInput.value, 10);
    if (isNaN(p)) v=0;
    p = Math.min(Math.max(p, parseInt(pitchRange.min)), parseInt(pitchRange.max));
    pitchInput.value = p;
    pitchRange.value = p;
    isConverted=false;
    updateButtonState();
});
//버튼의 클릭 이벤트
elements.convertBtn.onclick = convertText;
elements.modifyBtn.onclick = modifyText;
elements.downloadBtn.onclick = downloadAudio;
elements.playPauseBtn.onclick = function() {
    if (elements.audioPlayer.paused) {
        playAudio();
    } else {
        pauseAudio();
    }
};
elements.audioPlayer.onended = function() {                         // 재생이 끝나면 오디오 바를 처음 상태로
    elements.playPauseBtn.textContent = '▶';
    elements.progressBar.style.width = '0%';
    
    if (progressUpdateInterval) {
        clearInterval(progressUpdateInterval);
        progressUpdateInterval = null;
    }
    
    const totalTime = formatTime(elements.audioPlayer.duration);
    elements.timeDisplay.textContent = `0:00 / ${totalTime}`;
};
elements.progressContainer.onclick = function(e) {                  // 바의 중간을 클릭하면 그 부분에서 진행
    if (elements.audioPlayer.duration) {
        const rect = elements.progressContainer.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const width = rect.width;
        const clickRatio = clickX / width;
        const newTime = clickRatio * elements.audioPlayer.duration;
        
        elements.audioPlayer.currentTime = newTime;
        updateProgress();
    }
};
setInterval(function() {                                            // 서버에 생존신호 전송
    fetch('/heartbeat', { method: 'POST' }).catch(() => {});
}, 2000);
updateButtonState();
elements.uploadBtn.addEventListener('click', () => {                // 파일 업로드시
    elements.fileInput.click();
});
elements.fileInput.addEventListener('change', () => {
    const file = elements.fileInput.files[0];
    if (!file) return;
    
    modifyText(); 

    const reader = new FileReader();
    reader.onload = e => {
        elements.textInput.value = e.target.result;
        setTextLocked(false);
        showStatus('File uploaded', 'success');
    };
    reader.onerror = () => {
        showStatus('Failed to read file.', 'error');
    };
    reader.readAsText(file, 'UTF-8');
    elements.fileInput.value = '';
});
elements.textInput.addEventListener('input', () => {
    elements.convertBtn.disabled = false;
});
elements.volumeBtn.addEventListener('click', () => {                // 음소거 하기
    elements.audioPlayer.muted = !elements.audioPlayer.muted;
    // 버튼 아이콘도 바꿔주기
    if (elements.audioPlayer.muted) {
        elements.volumeBtn.textContent = '🔇';
    } else {
        elements.volumeBtn.textContent = '🔊';
    }
});
elements.volumeSlider.addEventListener('input', () => {             //볼륨 슬라이더로 조절
    elements.audioPlayer.volume = elements.volumeSlider.value;
    // 음소거 해제(슬라이더를 움직이면 자동으로 음소거 해제)
    if (elements.audioPlayer.muted && elements.audioPlayer.volume > 0) {
        elements.audioPlayer.muted = false;
        elements.volumeBtn.textContent = '🔊';
    }
});
async function init() {
  // 0) 페이지 로드 후, 서버에 아무 조건 없이 전체 옵션을 받아와 초기 채워넣기
    elements.formatLabel.style.display = 'none';
    elements.format.style.display = 'none';
    updateButtonState();
    lockgOthers(true);
    const allowed = await fetchAllowed({}); 
    applyOptions(langSel,   allowed.language);
    applyOptions(genSel,    allowed.gender);
    applyOptions(ageSel,    allowed.age);
    applyOptions(styleSel,  allowed.style);
  
    // placeholder('') 으로 남기고, 이벤트 리스너만 활성화
    // 언어 선택 전에 성별, 나이, 스타일을 고르면 안돼요
    ['gender','age','style'].forEach(key =>{
        const sel =elements[key];
        sel.addEventListener('mousedown',
            e =>{
            if (!isLanguageSelected()){
                e.preventDefault();
                showStatus('Select a language first','error');
            }
        })
    })
    elements.language.addEventListener('change', () => {
        if (isLanguageSelected()) {
            lockgOthers(false);  // 언어 골랐으면 잠금 해제
            // 여기서 서버 호출 → 옵션 필터링 로직 실행
        } else {
            lockgOthers(true);   // All로 돌아가면 다시 잠금
        }
    });

    // 성별 선택전에 나이, 스타일을 고르면 안돼요
    ['age','style'].forEach(key=>{
        const sel =elements[key];
        sel.addEventListener('mousedown',e =>{
            if (!isGenderSelected()){
                e.preventDefault();
                showStatus('Select a gender first','error');
            }
        })
    })
    elements.gender.addEventListener('change', () => {
        if (isGenderSelected()) {
            lockaOthers(false);  // 언어 골랐으면 잠금 해제
            // 여기서 서버 호출 → 옵션 필터링 로직 실행
        } else {
            lockaOthers(true);   // All로 돌아가면 다시 잠금
        }
    });

    // 나이 선택전에 스타일을 고르면 안돼요
    ['style'].forEach(key=>{
        const sel =elements[key];
        sel.addEventListener('mousedown',e =>{
            if (!isAgeSelected()){
                e.preventDefault();
                showStatus('Select an age first','error');
            }
        })
    })
    elements.age.addEventListener('change', () => {
        if (isAgeSelected()) {
            locksOthers(false);  // 언어 골랐으면 잠금 해제
            // 여기서 서버 호출 → 옵션 필터링 로직 실행
        } else {
            locksOthers(true);   // All로 돌아가면 다시 잠금
        }
    });

    // 넘버 드롭다운도 나이 선택 전에는 막기
    elements.number.addEventListener('mousedown', e => {
        if (!isAgeSelected()) {
            e.preventDefault();
            showStatus('Select an age first', 'error');
        }
    });
}
document.addEventListener('DOMContentLoaded', init);
