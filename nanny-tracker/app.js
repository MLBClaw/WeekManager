/** 阿姨考勤助手 - 主逻辑 */

// 数据存储
let records = JSON.parse(localStorage.getItem('nanny_records') || '[]');
let settings = JSON.parse(localStorage.getItem('nanny_settings') || '{"dailySalary":300,"workHours":8}');
let currentMonth = new Date();
let selectedDate = null;
let recognition = null;
let isRecording = false;

// 初始化
function init() {
    updateCurrentDate();
    loadSettings();
    renderCalendar();
    updateStats();
    renderRecords();
    initVoiceRecognition();
}

// 更新当前日期显示
function updateCurrentDate() {
    const now = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    document.getElementById('currentDate').textContent = now.toLocaleDateString('zh-CN', options);
}

// 加载设置
function loadSettings() {
    document.getElementById('dailySalary').value = settings.dailySalary || 300;
    document.getElementById('workHours').value = settings.workHours || 8;
}

// 保存设置
function saveSettings() {
    settings.dailySalary = parseInt(document.getElementById('dailySalary').value) || 300;
    settings.workHours = parseInt(document.getElementById('workHours').value) || 8;
    localStorage.setItem('nanny_settings', JSON.stringify(settings));
    updateStats();
}

// 上班打卡
function checkIn(type) {
    const today = formatDate(new Date());
    const existingIndex = records.findIndex(r => r.date === today);
    
    if (existingIndex >= 0) {
        records[existingIndex] = { ...records[existingIndex], type, updatedAt: new Date().toISOString() };
    } else {
        records.push({
            date: today,
            type: type,
            note: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }
    
    saveRecords();
    renderCalendar();
    updateStats();
    renderRecords();
    
    // 震动反馈（如果支持）
    if (navigator.vibrate) navigator.vibrate(50);
    
    showToast(type === 'work' ? '✓ 上班打卡成功！' : '⚠ 已记录请假');
}

// 显示请假弹窗
function showLeaveModal() {
    document.getElementById('leaveDate').value = formatDate(new Date());
    document.getElementById('leaveReason').value = '';
    document.getElementById('leaveModal').classList.add('show');
}

// 关闭弹窗
function closeModal() {
    document.getElementById('leaveModal').classList.remove('show');
}

// 保存请假记录
function saveLeave() {
    const date = document.getElementById('leaveDate').value;
    const reason = document.getElementById('leaveReason').value;
    
    if (!date) {
        showToast('请选择日期');
        return;
    }
    
    const existingIndex = records.findIndex(r => r.date === date);
    if (existingIndex >= 0) {
        records[existingIndex] = { 
            ...records[existingIndex], 
            type: 'leave', 
            note: reason,
            updatedAt: new Date().toISOString() 
        };
    } else {
        records.push({
            date: date,
            type: 'leave',
            note: reason,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }
    
    saveRecords();
    renderCalendar();
    updateStats();
    renderRecords();
    closeModal();
    
    showToast('✓ 请假记录已保存');
}

// 初始化语音识别
function initVoiceRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.continuous = false;
        recognition.interimResults = false;
        
        recognition.onstart = () => {
            isRecording = true;
            document.getElementById('voiceBtn').classList.add('recording');
            document.getElementById('voiceStatus').textContent = '正在录音，请说出请假日期和原因...';
        };
        
        recognition.onend = () => {
            isRecording = false;
            document.getElementById('voiceBtn').classList.remove('recording');
            document.getElementById('voiceStatus').textContent = '点击录音记录请假';
        };
        
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            processVoiceInput(transcript);
        };
        
        recognition.onerror = (event) => {
            showToast('录音出错: ' + event.error);
            isRecording = false;
            document.getElementById('voiceBtn').classList.remove('recording');
        };
    } else {
        document.getElementById('voiceBtn').style.display = 'none';
        document.getElementById('voiceStatus').textContent = '您的设备不支持语音输入';
    }
}

// 切换录音状态
function toggleVoiceRecord() {
    if (!recognition) {
        showToast('您的设备不支持语音输入');
        return;
    }
    
    if (isRecording) {
        recognition.stop();
    } else {
        recognition.start();
    }
}

// 处理语音输入
function processVoiceInput(text) {
    showToast('识别结果: ' + text);
    
    // 解析日期
    let date = null;
    const today = new Date();
    
    if (text.includes('今天')) {
        date = formatDate(today);
    } else if (text.includes('明天')) {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        date = formatDate(tomorrow);
    } else if (text.includes('昨天')) {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        date = formatDate(yesterday);
    } else {
        // 尝试匹配日期格式
        const dateMatch = text.match(/(\d{1,2})[月\/-](\d{1,2})/);
        if (dateMatch) {
            const month = dateMatch[1].padStart(2, '0');
            const day = dateMatch[2].padStart(2, '0');
            date = `${today.getFullYear()}-${month}-${day}`;
        }
    }
    
    if (!date) date = formatDate(today);
    
    // 提取请假原因
    let reason = text;
    if (text.includes('请假') || text.includes('休息')) {
        reason = text.replace(/.*请假/, '').replace(/.*休息/, '').trim() || '语音记录请假';
    }
    
    // 保存请假记录
    const existingIndex = records.findIndex(r => r.date === date);
    if (existingIndex >= 0) {
        records[existingIndex] = { 
            ...records[existingIndex], 
            type: 'leave', 
            note: reason,
            updatedAt: new Date().toISOString() 
        };
    } else {
        records.push({
            date: date,
            type: 'leave',
            note: reason,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }
    
    saveRecords();
    renderCalendar();
    updateStats();
    renderRecords();
    
    showToast(`✓ 已记录 ${date} 请假: ${reason}`);
}

// 渲染日历
function renderCalendar() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    document.getElementById('calendarMonth').textContent = `${year}年${month + 1}月`;
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = formatDate(new Date());
    
    let html = `
        <div class="calendar-header">日</div>
        <div class="calendar-header">一</div>
        <div class="calendar-header">二</div>
        <div class="calendar-header">三</div>
        <div class="calendar-header">四</div>
        <div class="calendar-header">五</div>
        <div class="calendar-header">六</div>
    `;
    
    // 空白填充
    for (let i = 0; i < firstDay; i++) {
        html += '<div></div>';
    }
    
    // 日期
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const record = records.find(r => r.date === dateStr);
        const isToday = dateStr === today;
        
        let className = 'calendar-day';
        if (record?.type === 'work') className += ' work';
        if (record?.type === 'leave') className += ' leave';
        if (isToday) className += ' today';
        
        let note = '';
        if (record?.note) {
            note = '<span class="note">•</span>';
        }
        
        html += `<div class="${className}" onclick="onDayClick('${dateStr}')">${day}${note}</div>`;
    }
    
    document.getElementById('calendar').innerHTML = html;
}

// 切换月份
function changeMonth(delta) {
    currentMonth.setMonth(currentMonth.getMonth() + delta);
    renderCalendar();
}

// 日期点击
function onDayClick(date) {
    selectedDate = date;
    const record = records.find(r => r.date === date);
    if (record) {
        document.getElementById('dayNote').value = record.note || '';
    } else {
        document.getElementById('dayNote').value = '';
    }
    document.getElementById('noteModal').classList.add('show');
}

// 关闭备注弹窗
function closeNoteModal() {
    document.getElementById('noteModal').classList.remove('show');
}

// 保存日期备注
function saveDayNote() {
    const note = document.getElementById('dayNote').value;
    const existingIndex = records.findIndex(r => r.date === selectedDate);
    
    if (existingIndex >= 0) {
        records[existingIndex].note = note;
        records[existingIndex].updatedAt = new Date().toISOString();
    } else {
        records.push({
            date: selectedDate,
            type: 'work',
            note: note,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }
    
    saveRecords();
    renderCalendar();
    renderRecords();
    closeNoteModal();
    showToast('✓ 备注已保存');
}

// 更新统计
function updateStats() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const monthRecords = records.filter(r => {
        const d = new Date(r.date);
        return d.getFullYear() === year && d.getMonth() === month;
    });
    
    const workDays = monthRecords.filter(r => r.type === 'work').length;
    const leaveDays = monthRecords.filter(r => r.type === 'leave').length;
    const salary = workDays * (settings.dailySalary || 300);
    
    document.getElementById('workDays').textContent = workDays;
    document.getElementById('leaveDays').textContent = leaveDays;
    document.getElementById('salary').textContent = salary;
}

// 渲染记录列表
function renderRecords() {
    const listEl = document.getElementById('recordList');
    
    if (records.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <p>暂无记录</p>
            </div>
        `;
        return;
    }
    
    const sortedRecords = [...records].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    let html = '';
    sortedRecords.forEach(record => {
        const date = new Date(record.date);
        const dateStr = `${date.getMonth() + 1}月${date.getDate()}日`;
        const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
        
        html += `
            <div class="record-item">
                <div>
                    <div class="record-date">${dateStr} ${weekday}</div>
                    ${record.note ? `<div class="record-note">${record.note}</div>` : ''}
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="record-type ${record.type}">${record.type === 'work' ? '上班' : '请假'}</span>
                    <button class="delete-btn" onclick="deleteRecord('${record.date}')">×</button>
                </div>
            </div>
        `;
    });
    
    listEl.innerHTML = html;
}

// 删除记录
function deleteRecord(date) {
    if (!confirm('确定要删除这条记录吗？')) return;
    
    records = records.filter(r => r.date !== date);
    saveRecords();
    renderCalendar();
    updateStats();
    renderRecords();
    showToast('✓ 记录已删除');
}

// 保存记录到本地存储
function saveRecords() {
    localStorage.setItem('nanny_records', JSON.stringify(records));
}

// 导出数据
function exportData() {
    const data = {
        records: records,
        settings: settings,
        exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `阿姨考勤数据_${formatDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('✓ 数据已导出');
}

// 导入数据
function importData(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.records) {
                records = data.records;
                saveRecords();
            }
            if (data.settings) {
                settings = data.settings;
                localStorage.setItem('nanny_settings', JSON.stringify(settings));
                loadSettings();
            }
            renderCalendar();
            updateStats();
            renderRecords();
            showToast('✓ 数据导入成功');
        } catch (err) {
            showToast('✗ 数据格式错误');
        }
    };
    reader.readAsText(file);
    input.value = '';
}

// 清空数据
function clearAllData() {
    if (!confirm('确定要清空所有数据吗？此操作不可恢复！')) return;
    
    records = [];
    saveRecords();
    renderCalendar();
    updateStats();
    renderRecords();
    showToast('✓ 数据已清空');
}

// 页面切换
function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    document.getElementById(`page-${page}`).classList.add('active');
    event.target.closest('.nav-item').classList.add('active');
}

// 格式化日期
function formatDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Toast 提示
function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 15px 30px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 9999;
        animation: fadeIn 0.3s;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
`;
document.head.appendChild(style);

// 初始化应用
init();
