(()=>{
  const $ = (s, root=document)=>root.querySelector(s);
  const $$ = (s, root=document)=>Array.from(root.querySelectorAll(s));
  const LSKEY = 'ecg_jcg_checklist_v2';
  const MANAGER_PASSWORD = 'ecgjcg1212';

  // API Functions
  async function loadInstructors() {
    try {
      console.log('Loading instructors from:', API_ENDPOINTS.INSTRUCTORS);
      const response = await api.get(API_ENDPOINTS.INSTRUCTORS);
      console.log('Instructors response:', response);
      state.instructors = response;
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

  async function addStudent(studentData){
    try {
      const response = await api.post(API_ENDPOINTS.STUDENTS, studentData);
      state.students.push(response);
      await renderDashboard();
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
      await renderDashboard();
    } catch (error) {
      console.error('Failed to update student:', error);
      alert('生徒の更新に失敗しました');
    }
  }

  async function removeStudent(id){
    try {
      await api.delete(`${API_ENDPOINTS.STUDENTS}/${id}`);
      state.students = state.students.filter(s => s.id !== id);
      await renderDashboard();
    } catch (error) {
      console.error('Failed to remove student:', error);
      alert('生徒の削除に失敗しました');
    }
  }

  function updateInstructorList() {
    const select = $('#newStudentInstructor');
    if (!select) return;
    
    select.innerHTML = '<option value="">講師を選択</option>';
    state.instructors.forEach(instructor => {
      const option = document.createElement('option');
      option.value = instructor.id;
      option.textContent = instructor.name;
      select.appendChild(option);
    });
  }

  /*** State ***/
  let state = {
    instructors: [],          // [{id,name}]
    students: [],             // [{id,name,instructorId,note}]
    weekly: {},               // { 'YYYY-Www': { [id]: { dm:false, dmDate:'', lesson:false, lessonDate:'' } } }
    monthly: {},              // { 'YYYY-MM': { [id]: { paid: false, lastPaid: '', survey: false } } }
    ui: {
      mode: 'weekly',         // 'weekly' | 'monthly' | 'calendar'
      weekStart: startOfISOWeek(getCurrentDate()),
      monthStart: startOfMonth(getCurrentDate()),
      calendarStart: startOfMonth(getCurrentDate()),
      selectedInstructor: 'all' // 'all' | instructorId
    }
  };

  let isLoggedIn = false;
  let currentMonth = startOfMonth(getCurrentDate());
  let currentTheme = 'dark';

  /*** Utils: dates ***/
  function startOfISOWeek(d){
    const date = new Date(d); const day = (date.getDay()+6)%7; // Mon=0..Sun=6
    date.setHours(0,0,0,0); date.setDate(date.getDate()-day);
    return date;
  }
  function addDays(d, n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
  function startOfMonth(d){ const x=new Date(d); x.setHours(0,0,0,0); x.setDate(1); return x; }
  function addMonths(d, n){ const x=new Date(d); x.setMonth(x.getMonth()+n); return startOfMonth(x); }
  
  function getCurrentDate(){
    return new Date();
  }
  function fmtDate(d){ return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`; }
  function fmtYearMonth(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
  
  // Get monthly data for current month
  function getMonthlyData(month = currentMonth) {
    const monthKey = fmtYearMonth(month);
    if (!state.monthly[monthKey]) {
      state.monthly[monthKey] = {};
    }
    return state.monthly[monthKey];
  }
  
  // Get student's monthly data
  function getStudentMonthlyData(studentId, month = currentMonth) {
    const monthKey = fmtYearMonth(month);
    const monthlyData = getMonthlyData(month);
    if (!monthlyData[studentId]) {
      monthlyData[studentId] = { paid: false, lastPaid: '', survey: false };
    }
    console.log(`Getting data for student ${studentId} in month ${monthKey}:`, monthlyData[studentId]);
    return monthlyData[studentId];
  }

  /*** Storage ***/
  function load(){
    try{
      const raw = localStorage.getItem(LSKEY);
      if(raw){
        const parsed = JSON.parse(raw);
        state = Object.assign(state, parsed);
        
        // Date revive
        const now = getCurrentDate();
        try {
          state.ui.weekStart = new Date(state.ui.weekStart);
          state.ui.monthStart = new Date(state.ui.monthStart);
          state.ui.calendarStart = new Date(state.ui.calendarStart);
        } catch(e) {
          console.warn('Date parsing failed, using current date');
        }
        
        if(!state.ui.weekStart || isNaN(state.ui.weekStart.getTime()) || state.ui.weekStart.getFullYear() < 2020) {
          state.ui.weekStart = startOfISOWeek(now);
        }
        if(!state.ui.monthStart || isNaN(state.ui.monthStart.getTime()) || state.ui.monthStart.getFullYear() < 2020) {
          state.ui.monthStart = startOfMonth(now);
        }
        if(!state.ui.calendarStart || isNaN(state.ui.calendarStart.getTime()) || state.ui.calendarStart.getFullYear() < 2020) {
          state.ui.calendarStart = startOfMonth(now);
        }
      }
    }catch(e){ console.warn('load failed', e); }
  }
  function save(){
    localStorage.setItem(LSKEY, JSON.stringify(state));
  }

  /*** Theme management ***/
  function setTheme(theme) {
    currentTheme = theme;
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

  /*** Authentication ***/
  function checkAuth(){
    const session = sessionStorage.getItem('manager_auth');
    if(session === 'true'){
      isLoggedIn = true;
      showDashboard();
    } else {
      showLogin();
    }
  }

  function login(password){
    if(password === MANAGER_PASSWORD){
      isLoggedIn = true;
      sessionStorage.setItem('manager_auth', 'true');
      showDashboard();
      return true;
    }
    return false;
  }

  function logout(){
    isLoggedIn = false;
    sessionStorage.removeItem('manager_auth');
    showLogin();
  }

  function showLogin(){
    $('#loginScreen').style.display = 'flex';
    $('#managerDashboard').style.display = 'none';
  }

  function showDashboard(){
    $('#loginScreen').style.display = 'none';
    $('#managerDashboard').style.display = 'block';
    renderDashboard();
  }

  /*** Dashboard rendering ***/
  function renderDashboard(){
    console.log('Rendering dashboard for month:', fmtYearMonth(currentMonth));
    updateMonthDisplay();
    renderStudentTable();
    updateInstructorSelects();
  }

  function updateMonthDisplay(){
    const m = currentMonth;
    const mEnd = addDays(addMonths(m,1), -1);
    $('#monthLabel').textContent = `${fmtYearMonth(m)}`;
    $('#monthRange').textContent = `${fmtDate(m)} 〜 ${fmtDate(mEnd)}`;
  }

  function renderStudentTable(){
    const tbody = $('#studentTableBody');
    const cardsContainer = $('#studentCards');
    tbody.innerHTML = '';
    cardsContainer.innerHTML = '';
    
    state.students.forEach(student => {
      const payment = getStudentMonthlyData(student.id, currentMonth);
      // APIから返されるデータの形式に合わせて修正
      const instructorId = student.instructor_id || student.instructorId;
      const instructor = state.instructors.find(i => i.id === instructorId);
      // instructor_nameが直接含まれている場合はそれを使用
      const instructorName = student.instructor_name || (instructor ? instructor.name : '未設定');
      
      // PC版テーブル行
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${escapeHtml(student.name)}</td>
        <td>${escapeHtml(instructorName)}</td>
        <td>${escapeHtml(student.member_number || student.memberNumber || '')}</td>
        <td>${escapeHtml(student.registrationDate ? fmtDate(new Date(student.registrationDate)) : '')}</td>
        <td>${escapeHtml(student.note || '')}</td>
        <td>
          <button class="payment-toggle ${payment.paid ? 'paid' : 'unpaid'}" data-student="${student.id}" data-type="payment">
            ${payment.paid ? '入金済み' : '未入金'}
          </button>
        </td>
        <td>
          <button class="survey-toggle ${payment.survey ? 'sent' : 'unsent'}" data-student="${student.id}" data-type="survey">
            ${payment.survey ? '回答済み' : '未回答'}
          </button>
        </td>
        <td>
          <button class="btn ghost" data-edit="${student.id}">編集</button>
        </td>
      `;
      tbody.appendChild(row);
      
      // スマホ版カード
      const card = document.createElement('div');
      card.className = 'student-card';
      card.innerHTML = `
        <div class="student-card-header">
          <div class="student-name">${escapeHtml(student.name)}</div>
          <div class="member-number">${escapeHtml(student.member_number || student.memberNumber || '')}</div>
        </div>
        <div class="student-info">
          <div class="info-item">
            <div class="info-label">登録日</div>
            <div class="info-value">${escapeHtml(student.registrationDate ? fmtDate(new Date(student.registrationDate)) : '')}</div>
          </div>
          <div class="info-item">
            <div class="info-label">担当講師</div>
            <div class="info-value">${escapeHtml(instructorName)}</div>
          </div>
          <div class="info-item">
            <div class="info-label">メモ</div>
            <div class="info-value">${escapeHtml(student.note || 'なし')}</div>
          </div>
        </div>
        <div class="student-actions">
          <div class="status-group">
            <button class="mobile-payment-toggle ${payment.paid ? 'paid' : 'unpaid'}" data-student="${student.id}" data-type="payment">
              ${payment.paid ? '入金済み' : '未入金'}
            </button>
            <button class="mobile-survey-toggle ${payment.survey ? 'sent' : 'unsent'}" data-student="${student.id}" data-type="survey">
              ${payment.survey ? '回答済み' : '未回答'}
            </button>
          </div>
          <button class="mobile-edit-btn" data-edit="${student.id}">編集</button>
        </div>
      `;
      cardsContainer.appendChild(card);
    });
    
    // Bind PC版 toggle buttons
    $$('#studentTableBody .payment-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const studentId = btn.dataset.student;
        const currentPayment = getStudentMonthlyData(studentId, currentMonth);
        updatePayment(studentId, !currentPayment.paid, currentPayment.survey);
      });
    });
    
    $$('#studentTableBody .survey-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const studentId = btn.dataset.student;
        const currentPayment = getStudentMonthlyData(studentId, currentMonth);
        updatePayment(studentId, currentPayment.paid, !currentPayment.survey);
      });
    });
    
    // Bind PC版 edit buttons
    $$('#studentTableBody [data-edit]').forEach(btn => {
      btn.addEventListener('click', () => openEditStudent(btn.dataset.edit));
    });
    
    // Bind スマホ版 toggle buttons
    $$('#studentCards .mobile-payment-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const studentId = btn.dataset.student;
        const currentPayment = getStudentMonthlyData(studentId, currentMonth);
        updatePayment(studentId, !currentPayment.paid, currentPayment.survey);
      });
    });
    
    $$('#studentCards .mobile-survey-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const studentId = btn.dataset.student;
        const currentPayment = getStudentMonthlyData(studentId, currentMonth);
        updatePayment(studentId, currentPayment.paid, !currentPayment.survey);
      });
    });
    
    // Bind スマホ版 edit buttons
    $$('#studentCards [data-edit]').forEach(btn => {
      btn.addEventListener('click', () => openEditStudent(btn.dataset.edit));
    });
  }

  function updateInstructorSelects(){
    const selects = ['#newStudentInstructor', '#editStudentInstructor'];
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

  /*** Student management ***/
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

  function addStudent(data){
    const id = 's_'+Math.random().toString(36).slice(2,10);
    const memberNumber = generateMemberNumber();
    state.students.push({id, memberNumber, ...data});
    // Initialize monthly data for current month
    getStudentMonthlyData(id, currentMonth);
    save(); renderDashboard();
  }

  function updateStudent(id, data){
    const student = state.students.find(x=>x.id===id);
    if(student) Object.assign(student, data);
    save(); renderDashboard();
  }

  function updatePayment(id, paid, survey){
    const monthKey = fmtYearMonth(currentMonth);
    const monthlyData = getStudentMonthlyData(id, currentMonth);
    monthlyData.paid = paid;
    monthlyData.survey = survey;
    if(paid) {
      monthlyData.lastPaid = fmtDate(getCurrentDate());
    }
    console.log(`Updated payment for student ${id} in month ${monthKey}:`, monthlyData);
    save(); renderDashboard();
  }

  function removeStudent(id){
    state.students = state.students.filter(x=>x.id!==id);
    for(const k in state.weekly){ if(state.weekly[k][id]) delete state.weekly[k][id]; }
    for(const k in state.monthly){ if(state.monthly[k][id]) delete state.monthly[k][id]; }
    save(); renderDashboard();
  }

  /*** Modals ***/
  const addStudentDlg = $('#addStudentDlg');
  const editStudentDlg = $('#editStudentDlg');
  let editingStudentId = null;

  function openAddStudent(){
    $('#newStudentName').value = '';
    $('#newStudentInstructor').value = '';
    $('#newStudentNote').value = '';
    $('#newStudentEmail').value = '';
    $('#newStudentRegistrationDate').value = '';
    updateInstructorSelects();
    addStudentDlg.showModal();
  }

  function openEditStudent(id){
    editingStudentId = id;
    const student = state.students.find(x=>x.id===id);
    const payment = getStudentMonthlyData(id, currentMonth);
    
    if(!student) return;
    
    $('#editStudentName').value = student.name || '';
    $('#editStudentInstructor').value = student.instructorId || '';
    $('#editStudentNote').value = student.note || '';
    $('#editStudentMemberNumber').value = student.memberNumber || '';
    $('#editStudentEmail').value = student.email || '';
    $('#editStudentRegistrationDate').value = student.registrationDate || '';
    $('#editStudentPayment').value = payment.paid.toString();
    $('#editStudentSurvey').value = payment.survey.toString();
    
    updateInstructorSelects();
    editStudentDlg.showModal();
  }

  /*** Export / Import ***/
  function doExport(){
    const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `class1-manager-backup-${Date.now()}.json`;
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
          if(!data || !Array.isArray(data.students)) throw new Error('不正なファイルです');
          state = data;
          
          const now = getCurrentDate();
          state.ui.weekStart = new Date(state.ui.weekStart);
          state.ui.monthStart = new Date(state.ui.monthStart);
          state.ui.calendarStart = new Date(state.ui.calendarStart);
          
          if(isNaN(state.ui.weekStart.getTime())) state.ui.weekStart = startOfISOWeek(now);
          if(isNaN(state.ui.monthStart.getTime())) state.ui.monthStart = startOfMonth(now);
          if(isNaN(state.ui.calendarStart.getTime())) state.ui.calendarStart = startOfMonth(now);
          
          save(); renderDashboard(); alert('インポートしました。');
        }catch(e){ alert('インポートに失敗しました: '+e.message); }
      };
      reader.readAsText(file);
    };
    inp.click();
  }

  /*** Helpers ***/
  function escapeHtml(str){ return (str??'').replace(/[&<>"']/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;','\'':'&#39;' }[s])); }

  /*** Events ***/
  $('#loginForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    const password = $('#password').value;
    if(login(password)){
      $('#password').value = '';
    } else {
      alert('パスワードが正しくありません。');
    }
  });

  $('#btnBackToMainFromLogin').addEventListener('click', ()=>{
    window.location.href = 'index.html';
  });

  $('#btnBackToMain').addEventListener('click', ()=>{
    window.location.href = 'index.html';
  });

  $('#btnLogout').addEventListener('click', logout);

  $('#prevMonth').addEventListener('click', ()=>{
    currentMonth = addMonths(currentMonth, -1);
    renderDashboard();
  });

  $('#nextMonth').addEventListener('click', ()=>{
    currentMonth = addMonths(currentMonth, +1);
    renderDashboard();
  });

  $('#btnAddStudent').addEventListener('click', openAddStudent);
  $('#btnViewSurveyResults').addEventListener('click', () => {
    window.location.href = 'a.html';
  });

  // Theme toggle
  $('#themeToggle').addEventListener('click', ()=>{
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  });
  $('#cancelAddStudent').addEventListener('click', ()=>addStudentDlg.close());
  $('#saveAddStudent').addEventListener('click', ()=>{
    const name = $('#newStudentName').value.trim();
    if(!name){ alert('生徒名は必須です'); return; }
    addStudent({
      name, 
      instructorId: $('#newStudentInstructor').value || null, 
      note: $('#newStudentNote').value.trim(),
      email: $('#newStudentEmail').value.trim(),
      registrationDate: $('#newStudentRegistrationDate').value.trim() || undefined
    });
    addStudentDlg.close();
  });

  $('#closeEditStudent').addEventListener('click', ()=>editStudentDlg.close());
  $('#deleteStudent').addEventListener('click', ()=>{
    if(!editingStudentId) return;
    if(confirm('この生徒を削除しますか？')){
      removeStudent(editingStudentId);
      editStudentDlg.close();
    }
  });

  $('#editStudentName').addEventListener('input', e=>
    editingStudentId && updateStudent(editingStudentId, {name:e.target.value})
  );
  $('#editStudentInstructor').addEventListener('change', e=>
    editingStudentId && updateStudent(editingStudentId, {instructorId:e.target.value || null})
  );
  $('#editStudentNote').addEventListener('input', e=>
    editingStudentId && updateStudent(editingStudentId, {note:e.target.value})
  );
  $('#editStudentEmail').addEventListener('input', e=>
    editingStudentId && updateStudent(editingStudentId, {email:e.target.value})
  );
  $('#editStudentRegistrationDate').addEventListener('input', e=>
    editingStudentId && updateStudent(editingStudentId, {registrationDate:e.target.value})
  );
  $('#editStudentPayment').addEventListener('change', e=>
    editingStudentId && updatePayment(editingStudentId, e.target.value === 'true', 
      $('#editStudentSurvey').value === 'true')
  );
  $('#editStudentSurvey').addEventListener('change', e=>
    editingStudentId && updatePayment(editingStudentId, 
      $('#editStudentPayment').value === 'true', e.target.value === 'true')
  );

  // Initialize
  async function initialize() {
    console.log('Initializing manager application...');
    console.log('API_BASE_URL:', API_BASE_URL);
    console.log('API_ENDPOINTS:', API_ENDPOINTS);
    
    initTheme();
    
    // Load data from backend
    console.log('Loading data from backend...');
    await loadInstructors();
    await loadStudents();
    
    console.log('Final state:', state);
    checkAuth();
  }

  // init
  initialize();
})(); 