(()=>{
  const $ = (s, root=document)=>root.querySelector(s);
  const $$ = (s, root=document)=>Array.from(root.querySelectorAll(s));

  /*** State ***/
  let state = {
    instructors: [],          // [{id,name}]
    students: [],             // [{id,name,instructorId,note,email,memberNumber,registrationDate}]
    weekly: {},               // { 'YYYY-Www': { [id]: { dm:false, dmDate:'', lesson:false, lessonDate:'' } } }
    ui: {
      mode: 'weekly',         // 'weekly' | 'monthly' | 'calendar'
      weekStart: startOfISOWeek(getCurrentDate()),
      monthStart: startOfMonth(getCurrentDate()),
      calendarStart: startOfMonth(getCurrentDate()),
      selectedInstructor: 'all', // 'all' | instructorId
      theme: 'dark' // 'dark' | 'light'
    }
  };

  /*** Utils: dates ***/
  function startOfISOWeek(d){
    const date = new Date(d); const day = (date.getDay()+6)%7; // Mon=0..Sun=6
    date.setHours(0,0,0,0); date.setDate(date.getDate()-day);
    return date;
  }
  function addDays(d, n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
  function startOfMonth(d){ const x=new Date(d); x.setHours(0,0,0,0); x.setDate(1); return x; }
  function addMonths(d, n){ const x=new Date(d); x.setMonth(x.getMonth()+n); return startOfMonth(x); }
  
  // 現在の日付を取得する関数
  function getCurrentDate(){
    return new Date();
  }
  function fmtDate(d){ return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`; }
  function fmtYearMonth(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
  function isoWeekStr(d){
    const date = new Date(d);
    // ISO week number
    const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = (tmp.getUTCDay() + 6) % 7;
    tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
    const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(),0,4));
    const week = 1 + Math.round(((tmp - firstThursday)/86400000 - 3 + ((firstThursday.getUTCDay()+6)%7))/7);
    const year = tmp.getUTCFullYear();
    return `${year}-W${String(week).padStart(2,'0')}`;
  }

  /*** Theme management ***/
  function setTheme(theme) {
    state.ui.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // Update theme toggle button
    const themeToggle = $('#themeToggle');
    if (themeToggle) {
      themeToggle.textContent = theme === 'dark' ? '🌙' : '☀️';
      themeToggle.title = theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え';
    }
  }

  function initTheme() {
    // Load saved theme or use system preference
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
    setTheme(theme);
  }

  /*** API Functions ***/
  async function loadInstructors() {
    try {
      console.log('Loading instructors from:', API_ENDPOINTS.INSTRUCTORS);
      const response = await api.get(API_ENDPOINTS.INSTRUCTORS);
      console.log('Instructors response:', response);
      state.instructors = response;
      updateInstructorFilter();
      updateInstructorList();
    } catch (error) {
      console.error('Failed to load instructors:', error);
    }
  }

  async function loadStudents() {
    try {
      console.log('Loading students from:', API_ENDPOINTS.STUDENTS);
      const response = await api.get(API_ENDPOINTS.STUDENTS);
      console.log('Students response:', response);
      state.students = response;
      console.log('Loaded students:', state.students);
    } catch (error) {
      console.error('Failed to load students:', error);
    }
  }

  async function loadWeeklyData(weekKey) {
    try {
      const response = await api.get(`${API_ENDPOINTS.WEEKLY}/${weekKey}`);
      state.weekly[weekKey] = response;
    } catch (error) {
      console.error('Failed to load weekly data:', error);
      state.weekly[weekKey] = {};
    }
  }

  async function addInstructor(name){
    try {
      const response = await api.post(API_ENDPOINTS.INSTRUCTORS, { name: name.trim() });
      state.instructors.push(response);
      updateInstructorFilter();
      updateInstructorList();
    } catch (error) {
      console.error('Failed to add instructor:', error);
      alert('講師の追加に失敗しました');
    }
  }

  async function removeInstructor(id){
    try {
      await api.delete(`${API_ENDPOINTS.INSTRUCTORS}/${id}`);
      state.instructors = state.instructors.filter(x => x.id !== id);
      updateInstructorFilter();
      updateInstructorList();
    } catch (error) {
      console.error('Failed to remove instructor:', error);
      alert('講師の削除に失敗しました');
    }
  }

  async function addStudent(studentData){
    try {
      const response = await api.post(API_ENDPOINTS.STUDENTS, studentData);
      state.students.push(response);
      await render();
    } catch (error) {
      console.error('Failed to add student:', error);
      alert('生徒の追加に失敗しました');
    }
  }

  async function updateStudent(id, updates){
    try {
      console.log('Updating student:', id, updates);
      const response = await api.put(`${API_ENDPOINTS.STUDENTS}/${id}`, updates);
      console.log('Update response:', response);
      const index = state.students.findIndex(s => s.id === id);
      if (index !== -1) {
        state.students[index] = response;
      }
      await render();
    } catch (error) {
      console.error('Failed to update student:', error);
      alert('生徒の更新に失敗しました');
    }
  }

  async function removeStudent(id){
    try {
      await api.delete(`${API_ENDPOINTS.STUDENTS}/${id}`);
      state.students = state.students.filter(s => s.id !== id);
      await render();
    } catch (error) {
      console.error('Failed to remove student:', error);
      alert('生徒の削除に失敗しました');
    }
  }

  async function updateWeeklyCheck(weekKey, studentId, checkType, value, date = '') {
    try {
      const currentData = state.weekly[weekKey] || {};
      const studentData = currentData[studentId] || { dm: false, dmDate: '', lesson: false, lessonDate: '' };
      
      if (checkType === 'dm') {
        studentData.dm = value;
        studentData.dmDate = date;
      } else if (checkType === 'lesson') {
        studentData.lesson = value;
        studentData.lessonDate = date;
      }

      await api.post(API_ENDPOINTS.WEEKLY, {
        weekKey,
        studentId,
        dm: studentData.dm,
        dmDate: studentData.dmDate,
        lesson: studentData.lesson,
        lessonDate: studentData.lessonDate
      });

      if (!state.weekly[weekKey]) {
        state.weekly[weekKey] = {};
      }
      state.weekly[weekKey][studentId] = studentData;
    } catch (error) {
      console.error('Failed to update weekly check:', error);
      alert('チェックの更新に失敗しました');
    }
  }

  function getInstructorName(id){
    const instructor = state.instructors.find(x => x.id === id);
    return instructor ? instructor.name : '未設定';
  }

  function getStudentInstructorName(student){
    // APIから返されるデータの形式に合わせて修正
    if (student.instructor_name) {
      return student.instructor_name;
    }
    const instructorId = student.instructor_id || student.instructorId;
    const instructor = state.instructors.find(x => x.id === instructorId);
    return instructor ? instructor.name : '未設定';
  }

  /*** Rendering ***/
  async function render(){
    const mode = state.ui.mode;
    
    // Load weekly data if needed
    if(mode === 'weekly') {
      const weekKey = isoWeekStr(state.ui.weekStart);
      await loadWeeklyData(weekKey);
    }
    // header toggles
    $('#tabWeekly').classList.toggle('active', mode==='weekly');
    $('#tabWeekly').setAttribute('aria-selected', mode==='weekly');
    $('#tabMonthly').classList.toggle('active', mode==='monthly');
    $('#tabMonthly').setAttribute('aria-selected', mode==='monthly');
    $('#tabCalendar').classList.toggle('active', mode==='calendar');
    $('#tabCalendar').setAttribute('aria-selected', mode==='calendar');

    // period labels
    if(mode==='weekly'){
      $('#rangeWeekly').style.display='flex';
      $('#rangeMonthly').style.display='none';
      $('#rangeCalendar').style.display='none';
      const start = state.ui.weekStart;
      const end = addDays(start, 6);
      $('#weekLabel').textContent = `${isoWeekStr(start)} 週`;
      $('#weekRange').textContent = `${fmtDate(start)} 〜 ${fmtDate(end)}`;
    }else if(mode==='monthly'){
      $('#rangeWeekly').style.display='none';
      $('#rangeMonthly').style.display='flex';
      $('#rangeCalendar').style.display='none';
      const m = state.ui.monthStart;
      const mEnd = addDays(addMonths(m,1), -1);
      $('#monthLabel').textContent = `${fmtYearMonth(m)}`;
      $('#monthRange').textContent = `${fmtDate(m)} 〜 ${fmtDate(mEnd)}`;
    }else if(mode==='calendar'){
      $('#rangeWeekly').style.display='none';
      $('#rangeMonthly').style.display='none';
      $('#rangeCalendar').style.display='flex';
      const m = state.ui.calendarStart;
      const mEnd = addDays(addMonths(m,1), -1);
      $('#calendarLabel').textContent = `${fmtYearMonth(m)}`;
      $('#calendarRange').textContent = `${fmtDate(m)} 〜 ${fmtDate(mEnd)}`;
    }

    // Show/hide appropriate content
    if(mode==='calendar'){
      $('#cards').style.display='none';
      $('#empty').style.display='none';
      $('#calendar').style.display='block';
      $('#instructorFilterContainer').style.display='flex';
      await renderCalendar();
      return;
    }else if(mode==='weekly'){
      $('#cards').style.display='grid';
      $('#calendar').style.display='none';
      $('#instructorFilterContainer').style.display='flex';
    }else{
      $('#cards').style.display='grid';
      $('#calendar').style.display='none';
      $('#instructorFilterContainer').style.display='none';
    }

    const cards = $('#cards');
    cards.innerHTML = '';
    
    // Filter students by instructor if needed
    let filteredStudents = state.students;
    if(state.ui.selectedInstructor !== 'all') {
      console.log('Filtering by instructor:', state.ui.selectedInstructor);
      filteredStudents = state.students.filter(s => {
        const instructorId = s.instructor_id || s.instructorId;
        console.log(`Student ${s.name}: instructor_id=${instructorId}, selected=${state.ui.selectedInstructor}, match=${instructorId === state.ui.selectedInstructor}`);
        return instructorId === state.ui.selectedInstructor;
      });
      console.log('Filtered students:', filteredStudents);
    }
    
    if(filteredStudents.length===0){
      $('#empty').style.display='block';
      return;
    } else {
      $('#empty').style.display='none';
    }

    const key = mode==='weekly' ? isoWeekStr(state.ui.weekStart) : fmtYearMonth(state.ui.monthStart);
    if(mode==='weekly' && !state.weekly[key]) state.weekly[key] = {};
    if(mode==='monthly' && !state.monthly[key]) state.monthly[key] = {};

    // 月次モードでは生徒カードを表示しない
    if(mode==='monthly') {
      $('#empty').style.display='block';
      $('#empty p').innerHTML='月次モードでは生徒カードは表示されません。<a href="manager.html" style="color: var(--accent); text-decoration: underline;">マネージャー専用ページ</a>をご利用ください。';
      return;
    }

    for(const s of filteredStudents){
      const card = document.createElement('section');
      card.className = 'card';
      card.innerHTML = `
        <header class="row">
          <div class="name">${escapeHtml(s.name)}</div>
          <span class="tag">講師: ${escapeHtml(getStudentInstructorName(s))}</span>
          ${s.note ? `<span class="tag">${escapeHtml(s.note)}</span>`:''}
          <button class="btn ghost" data-edit="${s.id}" aria-label="編集">編集</button>
        </header>
        <div class="checks"></div>
        <div class="progress">
          <span class="cap">進捗</span>
          <div class="meter"><i style="width:0%"></i></div>
          <span class="cap"><b class="pct">0%</b></span>
        </div>
      `;
      const checks = $('.checks', card);
      let done = 0, total = 0;

      if(mode==='weekly'){
        const wk = state.weekly[key][s.id] || {dm:false, dmDate:'', lesson:false, lessonDate:''};
        // DM 調整
        checks.appendChild(dateInputItem(
          `dm-${s.id}`,
          'DMで次回レッスン日を調整した',
          wk.dm,
          wk.dmDate,
          (val, date)=>{ 
            updateWeeklyCheck(key, s.id, 'dm', val, date); 
          }
        ));
        // レッスン実施
        checks.appendChild(dateInputItem(
          `lesson-${s.id}`,
          'レッスンを実施した',
          wk.lesson,
          wk.lessonDate,
          (val, date)=>{ 
            updateWeeklyCheck(key, s.id, 'lesson', val, date); 
          }
        ));
        done += (wk.dm?1:0) + (wk.lesson?1:0);
        total += 2;
      }else{
        // 月次モードではチェック項目を表示しない
        total += 0;
      }

      const pct = total ? Math.round((done/total)*100) : 0;
      $('.meter > i', card).style.width = pct+'%';
      $('.pct', card).textContent = pct+'%';
      $('#cards').appendChild(card);
    }

    // Bind edit buttons
    $$('#cards [data-edit]').forEach(btn=>{
      btn.addEventListener('click', ()=>openEdit(btn.dataset.edit));
    });
  }

  function checkItem(id, label, checked, onChange){
    const wrap = document.createElement('label');
    wrap.className = 'check';
    wrap.setAttribute('for', id);
    wrap.innerHTML = `
      <input type="checkbox" id="${id}" ${checked?'checked':''} />
      <div>
        <div>${escapeHtml(label)}</div>
        <div class="cap">タップで切り替え</div>
      </div>
    `;
    $('input', wrap).addEventListener('change', e=>{
      onChange(e.target.checked);
      save(); render();
    });
    return wrap;
  }

  function dateInputItem(id, label, checked, dateValue, onChange){
    const wrap = document.createElement('div');
    wrap.className = 'check';
    wrap.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; width: 100%;">
        <div style="
          width: 20px; height: 20px; 
          border: 2px solid ${checked ? 'var(--ok)' : 'rgba(255,255,255,.3)'}; 
          border-radius: 4px; 
          background: ${checked ? 'var(--ok)' : 'transparent'};
          display: flex; align-items: center; justify-content: center;
          color: white; font-size: 12px; font-weight: bold;
        ">${checked ? '✓' : ''}</div>
        <div style="flex: 1;">
          <div>${escapeHtml(label)}</div>
          <div class="cap">日付を入力すると完了になります</div>
          <div style="margin-top: 8px;">
            <input type="date" id="${id}-date" value="${dateValue}" style="
              background: rgba(255,255,255,.05);
              border: 1px solid rgba(255,255,255,.1);
              padding: 6px 8px;
              border-radius: 6px;
              color: var(--ink);
              font-size: 12px;
            " placeholder="日付を選択" />
            <div class="cap" style="margin-top: 4px;">
              ${id.includes('dm') ? '次回レッスン予定日を記録' : '実施日を記録'}
            </div>
          </div>
        </div>
      </div>
    `;
    
    const dateInput = $(`#${id}-date`, wrap);
    const checkmark = $('div:first-child', wrap);
    
    dateInput.addEventListener('change', e=>{
      const hasDate = e.target.value !== '';
      onChange(hasDate, e.target.value);
      save(); render();
    });
    
    return wrap;
  }

  /*** Calendar functions ***/
  async function renderCalendar(){
    // Load all weekly data for the calendar month
    const start = state.ui.calendarStart;
    const end = addDays(addMonths(start, 1), -1);
    
    // Calculate week keys for the month
    const weekKeys = [];
    let currentWeek = startOfISOWeek(start);
    while (currentWeek <= end) {
      weekKeys.push(isoWeekStr(currentWeek));
      currentWeek = addDays(currentWeek, 7);
    }
    
    // Load weekly data for all weeks in the month
    for (const weekKey of weekKeys) {
      await loadWeeklyData(weekKey);
    }
    const calendar = $('#calendar');
    
    // Get all lesson dates from weekly data
    const lessonEvents = [];
    for(const weekKey in state.weekly){
      const weekData = state.weekly[weekKey];
      for(const studentId in weekData){
        const student = state.students.find(s => s.id === studentId);
        if(!student) continue;
        
        // Filter by instructor if selected
        const instructorId = student.instructor_id || student.instructorId;
        if(state.ui.selectedInstructor !== 'all' && instructorId !== state.ui.selectedInstructor) {
          continue;
        }
        
        const weekInfo = weekData[studentId];
        if(weekInfo.dm && weekInfo.dmDate){
          const eventDate = new Date(weekInfo.dmDate);
          if(eventDate >= start && eventDate <= end){
            lessonEvents.push({
              date: eventDate,
              student: student,
              type: 'scheduled',
              weekKey: weekKey
            });
          }
        }
        if(weekInfo.lesson && weekInfo.lessonDate){
          const eventDate = new Date(weekInfo.lessonDate);
          if(eventDate >= start && eventDate <= end){
            lessonEvents.push({
              date: eventDate,
              student: student,
              type: 'completed',
              weekKey: weekKey
            });
          }
        }
      }
    }
    
    // Sort events by date
    lessonEvents.sort((a, b) => a.date - b.date);
    
    // Generate calendar HTML
    const firstDay = new Date(start);
    const lastDay = new Date(end);
    const startOfWeek = new Date(firstDay);
    startOfWeek.setDate(firstDay.getDate() - firstDay.getDay());
    const endOfWeek = new Date(lastDay);
    endOfWeek.setDate(lastDay.getDate() + (6 - lastDay.getDay()));
    
    let calendarHTML = '<div class="calendar-header">';
    ['日', '月', '火', '水', '木', '金', '土'].forEach(day => {
      calendarHTML += `<div>${day}</div>`;
    });
    calendarHTML += '</div><div class="calendar-body">';
    
    const today = getCurrentDate();
    today.setHours(0, 0, 0, 0);
    
    for(let d = new Date(startOfWeek); d <= endOfWeek; d.setDate(d.getDate() + 1)){
      const isOtherMonth = d < firstDay || d > lastDay;
      const isToday = d.getTime() === today.getTime();
      const dayClass = `calendar-day${isOtherMonth ? ' other-month' : ''}${isToday ? ' today' : ''}`;
      
      calendarHTML += `<div class="${dayClass}">`;
      calendarHTML += `<div class="day-number">${d.getDate()}</div>`;
      
      // Add events for this day
      const dayEvents = lessonEvents.filter(event => {
        const eventDate = new Date(event.date);
        return eventDate.getDate() === d.getDate() && 
               eventDate.getMonth() === d.getMonth() && 
               eventDate.getFullYear() === d.getFullYear();
      });
      
      dayEvents.forEach(event => {
        const eventClass = event.type === 'completed' ? 'lesson-event completed' : 'lesson-event scheduled';
        const eventText = event.type === 'completed' ? '実施済み' : '予定';
        calendarHTML += `
          <div class="${eventClass}" title="${event.student.name} - ${getStudentInstructorName(event.student)}">
            <div class="student-name">${escapeHtml(event.student.name)}</div>
            <div class="instructor">${eventText} (${escapeHtml(getStudentInstructorName(event.student))})</div>
          </div>
        `;
      });
      
      calendarHTML += '</div>';
    }
    
    calendarHTML += '</div>';
    calendar.innerHTML = calendarHTML;
  }

  /*** Students CRUD ***/
  function generateMemberNumber(){
    // 既存の会員番号を取得してソート
    const existingNumbers = state.students
      .filter(s => s.memberNumber)
      .map(s => s.memberNumber)
      .sort();
    
    if(existingNumbers.length === 0) {
      return 'k11';
    }
    
    const lastNumber = existingNumbers[existingNumbers.length - 1];
    const letter = lastNumber.charAt(0);
    const number = parseInt(lastNumber.substring(1));
    
    if(number < 99) {
      return letter + (number + 1);
    } else {
      const nextLetter = String.fromCharCode(letter.charCodeAt(0) + 1);
      if(nextLetter <= 'z') {
        return nextLetter + '11';
      } else {
        // z99に達した場合、k11に戻る（循環）
        return 'k11';
      }
    }
  }

  /*** Modals ***/
  const dlg = $('#dlg');
  const editDlg = $('#editDlg');
  const instructorDlg = $('#instructorDlg');
  let editingId = null;

  function openAdd(){
    $('#studentName').value='';
    $('#studentInstructor').value='';
    $('#studentNote').value='';
    updateInstructorSelect();
    dlg.showModal();
  }
  function openEdit(id){
    console.log('Opening edit for student ID:', id);
    console.log('Available students:', state.students);
    editingId = id;
    const s = state.students.find(x=>x.id===id);
    if(!s) {
      console.error('Student not found:', id);
      return;
    }
    console.log('Found student:', s);
    $('#editName').value = s.name || '';
    $('#editInstructor').value = s.instructorId || '';
    $('#editNote').value = s.note || '';
    // $('#editMemberNumber').value = s.memberNumber || '';
    $('#editEmail').value = s.email || '';
    updateInstructorSelect();
    editDlg.showModal();
  }
  function openInstructorManager(){
    updateInstructorList();
    instructorDlg.showModal();
  }

  function updateInstructorSelect(){
    const selects = ['#studentInstructor', '#editInstructor'];
    selects.forEach(selectId => {
      const select = $(selectId);
      if(!select) return;
      
      select.innerHTML = '<option value="">講師を選択</option>';
      state.instructors.forEach(instructor => {
        const option = document.createElement('option');
        option.value = instructor.id;
        option.textContent = instructor.name;
        select.appendChild(option);
      });
    });
  }

  function updateInstructorList(){
    const list = $('#instructorList');
    list.innerHTML = '';
    
    state.instructors.forEach(instructor => {
      const item = document.createElement('div');
      item.className = 'row';
      item.style.marginBottom = '8px';
      item.innerHTML = `
        <span style="flex: 1;">${escapeHtml(instructor.name)}</span>
        <button class="btn danger" data-remove="${instructor.id}">削除</button>
      `;
      list.appendChild(item);
    });
    
    // Bind remove buttons
    $$('#instructorList [data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        if(confirm('この講師を削除しますか？')) {
          removeInstructor(btn.dataset.remove);
        }
      });
    });
  }

  function updateInstructorFilter(){
    const filter = $('#instructorFilter');
    if(!filter) return;
    
    filter.innerHTML = '<option value="all">全講師</option>';
    state.instructors.forEach(instructor => {
      const option = document.createElement('option');
      option.value = instructor.id;
      option.textContent = instructor.name;
      filter.appendChild(option);
    });
    filter.value = state.ui.selectedInstructor;
  }

  /*** Export / Import ***/
  function doExport(){
    const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `class1-checklist-backup-${Date.now()}.json`;
    a.click(); URL.revokeObjectURL(url);
  }
  function doImport(){
    const inp = document.createElement('input');
    inp.type='file'; inp.accept='application/json';
    inp.onchange = ()=>{
      const file = inp.files[0]; if(!file) return;
      const reader = new FileReader();
      reader.onload = ()=>{
        try{
          const data = JSON.parse(reader.result);
          // basic validation
          if(!data || !Array.isArray(data.students)) throw new Error('不正なファイルです');
          state = data;
          // revive dates
          const now = getCurrentDate();
          state.ui.weekStart = new Date(state.ui.weekStart);
          state.ui.monthStart = new Date(state.ui.monthStart);
          state.ui.calendarStart = new Date(state.ui.calendarStart);
          
          if(isNaN(state.ui.weekStart.getTime())) state.ui.weekStart = startOfISOWeek(now);
          if(isNaN(state.ui.monthStart.getTime())) state.ui.monthStart = startOfMonth(now);
          if(isNaN(state.ui.calendarStart.getTime())) state.ui.calendarStart = startOfMonth(now);
          
          save(); render(); alert('インポートしました。');
        }catch(e){ alert('インポートに失敗しました: '+e.message); }
      };
      reader.readAsText(file);
    };
    inp.click();
  }

  /*** Reset period ***/
  function resetCurrentPeriod(){
    const mode = state.ui.mode;
    if(mode==='weekly'){
      const key = isoWeekStr(state.ui.weekStart);
      if(confirm(`週 ${key} のチェックを全てリセットします。よろしいですか？`)){
        state.weekly[key] = {};
        save(); render();
      }
    }else{
      const key = fmtYearMonth(state.ui.monthStart);
      if(confirm(`${key} のチェックを全てリセットします。よろしいですか？`)){
        state.monthly[key] = {};
        save(); render();
      }
    }
  }

  /*** Helpers ***/
  function escapeHtml(str){ return (str??'').replace(/[&<>"']/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;','\'':'&#39;' }[s])); }

  /*** Events ***/
  $('#tabWeekly').addEventListener('click', async ()=>{ state.ui.mode='weekly'; await render(); });
  $('#tabMonthly').addEventListener('click', ()=>{ window.location.href = 'manager.html'; });
  $('#tabCalendar').addEventListener('click', async ()=>{ state.ui.mode='calendar'; await render(); });

  $('#prevWeek').addEventListener('click', async ()=>{ state.ui.weekStart = addDays(state.ui.weekStart, -7); await render(); });
  $('#nextWeek').addEventListener('click', async ()=>{ state.ui.weekStart = addDays(state.ui.weekStart, +7); await render(); });

  $('#prevMonth').addEventListener('click', async ()=>{ state.ui.monthStart = addMonths(state.ui.monthStart, -1); await render(); });
  $('#nextMonth').addEventListener('click', async ()=>{ state.ui.monthStart = addMonths(state.ui.monthStart, +1); await render(); });

  $('#prevCalendar').addEventListener('click', async ()=>{ state.ui.calendarStart = addMonths(state.ui.calendarStart, -1); await render(); });
  $('#nextCalendar').addEventListener('click', async ()=>{ state.ui.calendarStart = addMonths(state.ui.calendarStart, +1); await render(); });

  $('#btnAdd').addEventListener('click', openAdd);
  $('#btnInstructor').addEventListener('click', openInstructorManager);
  $('#cancelDlg').addEventListener('click', ()=>dlg.close());
  $('#saveDlg').addEventListener('click', ()=>{
    const name = $('#studentName').value.trim();
    if(!name){ alert('生徒名は必須です'); return; }
    addStudent({
      name, 
      instructorId: $('#studentInstructor').value || null, 
      note: $('#studentNote').value.trim(),
      email: $('#studentEmail').value.trim()
    });
    dlg.close();
  });

  $('#closeEdit').addEventListener('click', ()=>editDlg.close());
  $('#deleteStudent').addEventListener('click', ()=>{
    if(!editingId) return;
    if(confirm('この生徒を削除しますか？')){
      removeStudent(editingId);
      editDlg.close();
    }
  });
  $('#editName').addEventListener('input', e=>editingId && updateStudent(editingId, {name:e.target.value}));
  $('#editInstructor').addEventListener('change', e=>editingId && updateStudent(editingId, {instructorId:e.target.value || null}));
  $('#editNote').addEventListener('input', e=>editingId && updateStudent(editingId, {note:e.target.value}));
  $('#editEmail').addEventListener('input', e=>editingId && updateStudent(editingId, {email:e.target.value}));

  $('#instructorFilter').addEventListener('change', async e=>{
    state.ui.selectedInstructor = e.target.value;
    await render();
  });

  $('#addInstructor').addEventListener('click', ()=>{
    const name = $('#newInstructorName').value.trim();
    if(!name){ alert('講師名は必須です'); return; }
    addInstructor(name);
    $('#newInstructorName').value = '';
  });

  $('#closeInstructorDlg').addEventListener('click', ()=>instructorDlg.close());

  // Theme toggle
  $('#themeToggle').addEventListener('click', ()=>{
    const newTheme = state.ui.theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  });

  // Initialize
  async function initialize() {
    console.log('Initializing application...');
    console.log('API_BASE_URL:', API_BASE_URL);
    console.log('API_ENDPOINTS:', API_ENDPOINTS);
    
    initTheme();
    
    // 強制的に現在の日付で初期化
    const now = getCurrentDate();
    console.log('Current date:', now);
    
    // 日付が無効または1970年以前の場合は現在の日付を使用
    if(!state.ui.weekStart || isNaN(state.ui.weekStart.getTime()) || state.ui.weekStart.getFullYear() < 2020) {
      state.ui.weekStart = startOfISOWeek(now);
      console.log('Reset weekStart to:', state.ui.weekStart);
    }
    if(!state.ui.monthStart || isNaN(state.ui.monthStart.getTime()) || state.ui.monthStart.getFullYear() < 2020) {
      state.ui.monthStart = startOfMonth(now);
      console.log('Reset monthStart to:', state.ui.monthStart);
    }
    if(!state.ui.calendarStart || isNaN(state.ui.calendarStart.getTime()) || state.ui.calendarStart.getFullYear() < 2020) {
      state.ui.calendarStart = startOfMonth(now);
      console.log('Reset calendarStart to:', state.ui.calendarStart);
    }
    
    // Load data from backend
    console.log('Loading data from backend...');
    await loadInstructors();
    await loadStudents();
    await loadWeeklyData(isoWeekStr(state.ui.weekStart));
    
    console.log('Final state:', state);
    await render();
    updateInstructorFilter();
  }

  // Start initialization
  initialize();
})(); 