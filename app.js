// 使用者提供的 Mapbox 公開 Token；可於 Mapbox 後台限制允許的網站來源。
mapboxgl.accessToken = 'pk.eyJ1Ijoib2R1bmdrIiwiYSI6ImNtdmd5YmNodzAxODkzNG83bWRpajBkaGwifQ.yqBZUhj7vjauHoaldWKLKA';
const ARENA=[121.5497,25.0511];
const OVERVIEW={center:[121.54,25.055],zoom:11.2,pitch:35,bearing:-12};
const map=new mapboxgl.Map({container:'map',style:'mapbox://styles/mapbox/streets-v12',...OVERVIEW,antialias:true});
map.addControl(new mapboxgl.NavigationControl(),'top-right');
map.on('style.load',()=>{
  const layers=map.getStyle().layers;
  const label=layers.find(l=>l.type==='symbol'&&l.layout?.['text-field']);
  if(!map.getLayer('3d-buildings'))map.addLayer({id:'3d-buildings',source:'composite','source-layer':'building',filter:['==',['get','extrude'],'true'],type:'fill-extrusion',minzoom:15,paint:{'fill-extrusion-color':'#b9c4ce','fill-extrusion-height':['interpolate',['linear'],['zoom'],15,0,15.05,['coalesce',['get','height'],0]],'fill-extrusion-base':['interpolate',['linear'],['zoom'],15,0,15.05,['coalesce',['get','min_height'],0]],'fill-extrusion-opacity':0.72}},label?.id);
});
const venues=[
 {name:'台北小巨蛋',coords:ARENA,address:'臺北市松山區南京東路四段2號',type:'大型演唱會場館',hasData:true},
 {name:'臺北流行音樂中心',address:'臺北市南港區市民大道八段99號',type:'中大型演唱會場館'},
 {name:'Legacy Taipei',address:'臺北市中正區八德路一段1號',type:'Live House'},
 {name:'Legacy TERA',address:'臺北市南港區市民大道八段99號',type:'Live House'},
 {name:'Legacy MAX',address:'臺北市信義區松壽路11號6樓',type:'音樂展演空間'},
 {name:'Legacy mini @ amba',address:'臺北市萬華區武昌街二段77號5樓',type:'小型音樂展演空間'},
 {name:'臺北大巨蛋',address:'臺北市信義區忠孝東路四段515號',type:'超大型多功能體育及演唱會場館'},
 {name:'女巫店',address:'臺北市大安區新生南路三段56巷7號',type:'獨立音樂展演空間'},
 {name:'The Wall Live House',address:'臺北市文山區羅斯福路四段200號',type:'Live House'},
 {name:'河岸留言西門紅樓展演館',address:'臺北市萬華區西寧南路177號',type:'Live House'},
 {name:'PIPE Live Music',address:'臺北市中正區思源街1號',type:'Live House'},
 {name:'台北國際會議中心 TICC',address:'臺北市信義區信義路五段1號',type:'大型會議及演唱會場館'}
];
let currentVenue=null,rentals=[],selectedDay=null,selectedMonth='2026-10';
let arenaRentals=[], venueEvents=[], dataLoaded=false;
const REPORT_MONTHS=Array.from({length:13},(_,i)=>{const d=new Date(2025,9+i,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`});
const PERIOD_LABEL='2025 年 10 月－2026 年 10 月 27 日';
const isArena=()=>currentVenue?.name==='台北小巨蛋';
// 臺北市資料大平臺：依小巨蛋租用類型連結到對應的官方資料集。
const ARENA_SOURCES = {
  '場地租用': 'https://data.taipei/dataset/detail?id=f0497727-b2cd-46fa-87c8-c6af6bb9eada',
  '主場館活動使用空間': 'https://data.taipei/dataset/detail?id=f73cbd3e-c8a3-4cbc-8cdd-f62d95e5ac9d',
  '廣場': 'https://data.taipei/dataset/detail?id=bcf11ef9-9855-4ee3-8750-ca3df5aaf6c4'
};
const ARENA_GENERAL_SOURCE = 'https://data.taipei/dataset/detail?id=f0497727-b2cd-46fa-87c8-c6af6bb9eada';

const VENUE_SOURCES = {
 '臺北流行音樂中心':'https://www.tmc.taipei/tw/blog/show?activity_category=events',
 'Legacy Taipei':'https://www.legacy.com.tw/page/programlist/',
 'Legacy TERA':'https://www.legacy.com.tw/page/programlist/',
 'Legacy MAX':'https://www.legacy.com.tw/page/programlist/',
 'Legacy mini @ amba':'https://www.legacy.com.tw/page/programlist/',
 '台北小巨蛋':ARENA_GENERAL_SOURCE,
 '臺北大巨蛋':'https://www.taipeidome.com.tw/Web/dome/',
 '女巫店':'https://www.witchhouse.org/performance',
 'The Wall Live House':'https://thewalllivehouse.kktix.cc/',
 '河岸留言西門紅樓展演館':'https://riversidelivehouse.kktix.cc/',
 'PIPE Live Music':'https://pipelivemusic.com/2026/',
 '台北國際會議中心 TICC':'https://www.ticc.com.tw/wSite/sp?BaseDSD=7&CtUnit=152&ctNode=318&mp=1&s_showdate=2026-05-01&xdUrl=%2FwSite%2Fap%2Flp_Activity_2.jsp'
};
const isPublished=r=>!['cancelled','canceled'].includes(String(r.status??'').toLowerCase());
function recordsForVenue(v){return v?.name==='台北小巨蛋'?arenaRentals:venueEvents.filter(r=>r.venue===v?.name && isPublished(r));}
function monthHasRecords(month) {
  const compact=month.replace('-','');
  return rentals.some(r=>String(r.start).slice(0,6)<=compact && String(r.end).slice(0,6)>=compact);
}
function availableMonths(){return REPORT_MONTHS.filter(monthHasRecords);}
function refreshMonthOptions(){
  const select=$('monthFilter');
  const previous=select.value;
  select.replaceChildren(new Option('全部月份','all'));
  for(const m of availableMonths())select.add(new Option(m,m));
  select.value=availableMonths().includes(previous)?previous:'all';
  const list=document.querySelector('.month-picker-options');
  if(list) {
    list.querySelectorAll('.month-picker-option').forEach(button=>{
      const value=button.dataset.month;
      button.hidden=value!=='all' && !monthHasRecords(value);
    });
    const trigger=document.querySelector('.month-picker-trigger');
    if(trigger)trigger.textContent=(select.selectedOptions[0]?.textContent??'全部月份')+' ▾';
  }
}
function applyVenueData(){
  rentals=recordsForVenue(currentVenue);
  previewMonth=null;selectedDay=null;
  refreshMonthOptions();
  renderRecords();renderCalendar();renderCharts();
}

let previewMonth = null; // 月份選單滑鼠預覽，不覆蓋正式選取
const $=id=>document.getElementById(id);
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateText=s=>`${s.slice(0,4)}/${s.slice(4,6)}/${s.slice(6,8)}`;
const monthText=s=>`${s.slice(0,4)}-${s.slice(4,6)}`;
const chart1=echarts.init($('monthly')),chart2=echarts.init($('types')),chart3=echarts.init($('statsChart'));
function focusVenue(v,coords){document.body.classList.remove('dashboard-awaiting-venue');currentVenue=v;selectedDay=null;previewMonth=null;showVenue();applyVenueData();map.flyTo({center:coords,zoom:16.5,pitch:65,bearing:-25,duration:1600});}
function showVenue(){
 if (!currentVenue) {
   venueTile?.classList.add('venue-awaiting-selection');
   $('venueTitle').textContent = '';
   $('venueInfo').textContent = '';
   return;
 }
 venueTile?.classList.remove('venue-awaiting-selection');
 $('venueTitle').textContent=currentVenue.name;
 const count = recordsForVenue(currentVenue).length;
 const source = VENUE_SOURCES[currentVenue.name];
 $('venueInfo').innerHTML=`<p><strong>${safe(currentVenue.type)}</strong> · ${safe(currentVenue.address)}</p><p>${isArena()?'2025 年 10 月－2026 年 9 月已收錄官方租用紀錄':`${PERIOD_LABEL} 已查證活動部分收錄：${count} 筆（非完整檔期）`}</p>${source?`<p><a href="${safe(source)}" target="_blank" rel="noopener noreferrer">${isArena()?'查看場館活動資料來源':'查看場館活動資料來源'}</a></p>`:''}`;
 $('recordHeading').textContent=isArena()?'小巨蛋租用紀錄':'已收錄活動紀錄';
}
function makePopup(v){const node=document.createElement('div');const title=document.createElement('h3');title.textContent=v.name;const address=document.createElement('p');address.textContent=v.address;const note=document.createElement('p');note.textContent=v.name==='台北小巨蛋'?'已有小巨蛋租用資料':'查看已收錄官方活動公告';node.append(title,address,note);return new mapboxgl.Popup({offset:25}).setDOMContent(node);}
// 記住目前選取的場館 Marker
let selectedMarker = null;
let isVenueFocused = false;

function placeMarker(v, coords) {
    const BLUE = '#27a9d2';
    const YELLOW = '#ffeb59';

    // 自訂純色 SVG 圖釘：沒有 Mapbox 預設的深色輪廓與陰影。
    // 第一個 path 是填色區，保留原本點選切換藍／黃的邏輯。
    const el = document.createElement('div');
    el.className = 'venue-marker';
    // 使用純 CSS 圖釘，避免 SVG 邊緣出現細色邊或陰影。
    el.innerHTML = '<div class="venue-pin-shape"><span class="venue-pin-hole"></span></div>';
    const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat(coords)
        .addTo(map);

    // 保留原本的 Hover 名稱標籤
    const tag = document.createElement('div');
    tag.className = 'venue-hover-label';

    const name = document.createElement('span');
    name.textContent = v.name;

    // 保留中文粗體設定
    if (/[\u4e00-\u9fff]/.test(v.name)) {
        name.dataset.chinese = 'true';
    }

    tag.appendChild(name);
    el.appendChild(tag);
    el.classList.add('venue-marker');

    // 根據目前圖釘在地圖上的位置，自動將標籤切換到有空間的一側。
    function positionHoverLabel() {
        const canvas = map.getContainer().getBoundingClientRect();
        const pin = el.getBoundingClientRect();
        const labelWidth = tag.offsetWidth;
        const pinCenter = pin.left + pin.width / 2;
        const spaceRight = canvas.right - pinCenter;
        const spaceLeft = pinCenter - canvas.left;
        const shouldFlip = spaceRight < labelWidth + 85 && spaceLeft > spaceRight;
        el.classList.toggle('venue-label-left', shouldFlip);
        // 小螢幕時限制標籤最大寬度，避免溢出地圖。
        tag.style.maxWidth = Math.max(120, canvas.width - 28) + 'px';
    }

    el.addEventListener('mouseenter', () => {
        positionHoverLabel();
        el.classList.add('is-hovered');
    });
    map.on('move', () => {
        if (el.classList.contains('is-hovered')) positionHoverLabel();
    });

    el.addEventListener('mouseleave', () => {
        el.classList.remove('is-hovered');
    });

    // 點選場館時更新標記顏色
    el.addEventListener('click', () => {
    // 再點一次同一個場館：只回到全景，保留黃色
    if (selectedMarker === marker && isVenueFocused) {
        map.flyTo({ ...OVERVIEW, duration: 1600 });
        isVenueFocused = false;
        return;
    }

    // 換成另一個場館時，上一個恢復藍色
    if (selectedMarker && selectedMarker !== marker) {
        selectedMarker.getElement()
            .querySelector('.venue-pin-shape')
            ?.style.setProperty('background-color', BLUE);
    }

    // 目前選取的場館變黃色
    el.querySelector('.venue-pin-shape')
        ?.style.setProperty('background-color', YELLOW);

    selectedMarker = marker;
    isVenueFocused = true;

    focusVenue(v, coords);
});
}
placeMarker(venues[0],ARENA);
// 其餘 11 個場館使用 Mapbox Geocoding 查詢；定位結果為近似地址位置，須人工核對。
async function loadVenueMarkers(){for(const v of venues.slice(1))try{
 const url=`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(v.address)}.json?country=tw&limit=1&access_token=${encodeURIComponent(mapboxgl.accessToken)}`;
 const res=await fetch(url);if(!res.ok)throw Error(`HTTP ${res.status}`);const json=await res.json();const coords=json.features?.[0]?.center;
 if(!coords){console.warn('找不到場館',v.name);continue;}placeMarker(v,coords);
}catch(e){console.warn('場館定位失敗',v.name,e);}}
map.on('load',loadVenueMarkers);
$('overviewBtn').addEventListener('click', () => {
    isVenueFocused = false;
    map.flyTo({ ...OVERVIEW, duration: 1600 });
});
$('arenaBtn')?.remove();

// 租用紀錄浮動展開：依內容高度調整，最多到右側 Dashboard 底部。
const venueTile = document.querySelector('.venue-tile');
const recordList = $('recordList');
const recordsHeading = document.querySelector('.records-heading');
const rightGrid = document.querySelector('.right-grid');
let recordsExpanded = false;

function resizeRecordPanel() {
    if (!venueTile || !recordList || !recordsHeading || !rightGrid || !currentVenue) return;
    const tileRect = venueTile.getBoundingClientRect();
    const headingRect = recordsHeading.getBoundingClientRect();
    const gridRect = rightGrid.getBoundingClientRect();
    const top = Math.max(0, headingRect.bottom - tileRect.top + 4);
    recordList.style.top = `${top}px`;
    // 收合時只使用場館卡片內剩餘空間，不得突出到下方圖表。
    const collapsed = Math.max(0, Math.min(85, Math.floor(tileRect.bottom - (tileRect.top + top) - 12)));
    // 展開時仍可向下覆蓋圖表，但不超過右側 Dashboard 底部。
    const maxHeight = Math.max(collapsed, gridRect.bottom - (tileRect.top + top));
    // Measure the actual rendered rows, not scrollHeight, which can retain
    // the previous expanded panel height after switching to fewer records.
    const contentHeight = Math.ceil(Array.from(recordList.children).reduce((height, child) => {
        const style = window.getComputedStyle(child);
        return height + child.getBoundingClientRect().height
            + parseFloat(style.marginTop || 0) + parseFloat(style.marginBottom || 0);
    }, 0));
    const target = recordsExpanded ? Math.min(contentHeight, maxHeight) : collapsed;
    recordList.style.height = `${target}px`;
    recordList.classList.toggle('is-scrollable', recordsExpanded && contentHeight > maxHeight);
}

// 月份選單開啟期間，從右往左移動即可展開紀錄；不要求滑鼠碰到紀錄文字。
let monthPickerActive = false;
let pickerPointerX = null;
let leftwardExpanded = false;
let enteredLeftInfo = false;
let closeMonthPickerOnExit = null;
function setRecordsExpanded(expanded) {
    if (!currentVenue || recordsExpanded === expanded) return;
    recordsExpanded = expanded;
    venueTile?.classList.toggle('records-expanded', expanded);
    resizeRecordPanel();
}
if (venueTile && recordList && recordsHeading && rightGrid) {
    function updateRecordsHover(event) {
        if (!currentVenue) return;
        // 選單已展開時，紀錄的展開狀態由全頁滑鼠移動決定，避免移回選單又收合。
        if (monthPickerActive) return;
        setRecordsExpanded(!event.target.closest('.month-picker'));
    }
    venueTile.addEventListener('mouseenter', updateRecordsHover);
    venueTile.addEventListener('pointermove', updateRecordsHover);
    venueTile.addEventListener('mouseleave', () => {
        if (!monthPickerActive) setRecordsExpanded(false);
    });
    // 月份清單採 fixed 定位，不能再用 trigger 的位置判斷往左；
    // 必須以實際展開的選項清單邊界為準。
    document.addEventListener('pointermove', event => {
        if (!monthPickerActive || !currentVenue) return;
        const picker = document.querySelector('.month-picker');
        const menu = document.querySelector('.month-picker-options');
        if (!picker || !menu) return;
        const menuRect = menu.getBoundingClientRect();
        const triggerRect = picker.getBoundingClientRect();
        const tileRect = venueTile.getBoundingClientRect();
        const isInMenu = event.clientX >= menuRect.left && event.clientX <= menuRect.right &&
                         event.clientY >= menuRect.top && event.clientY <= menuRect.bottom;
        const isInTrigger = event.clientX >= triggerRect.left && event.clientX <= triggerRect.right &&
                            event.clientY >= triggerRect.top && event.clientY <= triggerRect.bottom;
        if (isInMenu || isInTrigger) {
            if (leftwardExpanded) {
                leftwardExpanded = false;
                setRecordsExpanded(false);
            }
            pickerPointerX = event.clientX;
            return;
        }
        // 從右邊的月份選單向左移入資訊卡，立刻展開詳細紀錄。
        const inLeftInfo = event.clientX >= tileRect.left - 12 &&
                           event.clientX < menuRect.left - 3 &&
                           event.clientY >= tileRect.top &&
                           event.clientY <= Math.max(tileRect.bottom, menuRect.bottom);
        if (inLeftInfo) {
            leftwardExpanded = true;
            enteredLeftInfo = true;
            setRecordsExpanded(true);
            return;
        }
        // 往右離開選單則關閉；往左離開資訊卡才收合。
        if (event.clientX > Math.max(menuRect.right, triggerRect.right) + 8) {
            closeMonthPickerOnExit?.();
            setRecordsExpanded(false);
        } else if (leftwardExpanded && event.clientX < tileRect.left - 12) {
            closeMonthPickerOnExit?.();
            setRecordsExpanded(false);
        }
    });
    window.addEventListener('resize', resizeRecordPanel);
    requestAnimationFrame(resizeRecordPanel);
}

// 自訂月份選單：滑鼠移上去預覽、點選後正式套用。
// 保留原生 select 的值，避免影響既有的月份篩選及日期邏輯。
function setupMonthPreview() {
  const select = $('monthFilter');
  const heading = select.closest('.records-heading');
  if (!heading || heading.querySelector('.month-picker')) return;
  const picker = document.createElement('div');
  picker.className = 'month-picker';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'month-picker-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  const list = document.createElement('div');
  list.className = 'month-picker-options';
  list.setAttribute('role', 'listbox');
  const updateLabel = () => { trigger.textContent = (select.selectedOptions[0]?.textContent ?? '全部月份') + ' ▾'; };
  function preview(value) {
    if (!currentVenue) return;
    if (value !== 'all' && !monthHasRecords(value)) return;
    if (previewMonth === value) return;
    previewMonth = value;
    renderRecords();
    renderCalendar();
  }
  function close() {
    monthPickerActive = false;
    pickerPointerX = null;
    leftwardExpanded = false;
    enteredLeftInfo = false;
    picker.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
    if (previewMonth !== null) {
      previewMonth = null;
      renderRecords();
      renderCalendar();
    }
  }
  closeMonthPickerOnExit = close;
  for (const option of [{value:'all',textContent:'全部月份'}, ...REPORT_MONTHS.map(m=>({value:m,textContent:m}))]) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'month-picker-option';
    item.setAttribute('role', 'option');
    item.dataset.month = option.value;
    item.textContent = option.textContent;
    item.addEventListener('mouseenter', () => preview(option.value === 'all' ? 'all' : option.value));
    item.addEventListener('focus', () => preview(option.value === 'all' ? 'all' : option.value));
    item.addEventListener('click', () => {
      select.value = option.value;
      previewMonth = null;
      select.dispatchEvent(new Event('change', {bubbles:true}));
      updateLabel();
      close();
    });
    list.appendChild(item);
  }
  // 月份選單始終向下展開；過長時在選單內捲動，保留左右滑鼠互動。
  function positionMonthMenu() {
    const rect = trigger.getBoundingClientRect();
    const desired = Math.min(list.scrollHeight || 430, 430);
    const available = Math.max(65, window.innerHeight - rect.bottom - 8);
    const height = Math.min(desired, available);
    list.style.setProperty('--month-menu-height', `${height}px`);
    list.style.left = `${Math.max(8, Math.min(rect.right - Math.max(rect.width, 104), window.innerWidth - 116))}px`;
    list.style.top = `${rect.bottom}px`;
    list.style.minWidth = `${Math.max(104, rect.width)}px`;
  }
  window.addEventListener('resize', () => {
    if (picker.classList.contains('open')) positionMonthMenu();
  });
  window.addEventListener('scroll', () => {
    if (picker.classList.contains('open')) positionMonthMenu();
  }, true);
  function openPicker() {
    positionMonthMenu();
    if (!monthPickerActive) {
      monthPickerActive = true;
      pickerPointerX = picker.getBoundingClientRect().left + picker.getBoundingClientRect().width / 2;
      leftwardExpanded = false;
      enteredLeftInfo = false;
    }
    picker.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
    // 指標位於月份選單時不展開紀錄；移往左側紀錄區則正常展開。
    if (!leftwardExpanded && picker.matches(':hover')) setRecordsExpanded(false);
  }
  picker.addEventListener('pointerenter', () => {
    // 從左側回到月份選單：月份選單保留，左側詳細紀錄收合。
    if (monthPickerActive && leftwardExpanded) {
      leftwardExpanded = false;
      enteredLeftInfo = false;
      setRecordsExpanded(false);
    }
    openPicker();
  });
  // 滑鼠往右離開月份選單時，允許直接收起，不必選擇月份。
  // 往左離開時則保持選單開啟，讓使用者查看完整紀錄。
  picker.addEventListener('pointerleave', event => {
    if (!monthPickerActive) return;
    const bounds = picker.getBoundingClientRect();
    if (list.contains(event.relatedTarget)) return;
    const menuBounds = list.getBoundingClientRect();
    if (event.clientX >= Math.max(bounds.right, menuBounds.right) + 2) {
      close();
      setRecordsExpanded(false);
    }
  });
  picker.addEventListener('focusin', openPicker);
  trigger.addEventListener('click', openPicker);
  // 離開選單（包含往左移到紀錄區）時維持展開，直到選取月份。
  picker.addEventListener('keydown', e => { if (e.key === 'Escape') { close(); trigger.focus(); } });
  // 點擊選單以外的地方也不自動收合；只有選定月份或 Esc 才關閉。
  select.addEventListener('change', updateLabel);
  picker.append(trigger, list);
  heading.appendChild(picker);
  updateLabel();
}

function renderRecords(){
 if (!currentVenue) { $('recordList').replaceChildren(); requestAnimationFrame(resizeRecordPanel); return; }
 let rows=rentals.slice();const filter=previewMonth ?? $('monthFilter').value;
 if(filter!=='all')rows=rows.filter(r=>r.start.slice(0,6)<=filter.replace('-','') && r.end.slice(0,6)>=filter.replace('-',''));
 if(selectedDay && previewMonth === null){rows=rows.filter(r=>r.start<=selectedDay&&r.end>=selectedDay);$('recordHeading').textContent=`${dateText(selectedDay)} ${isArena()?'租用紀錄':'活動紀錄'}`;}else $('recordHeading').textContent=isArena()?'小巨蛋租用紀錄':'已收錄活動紀錄';
 rows.sort((a,b)=>b.start.localeCompare(a.start));
 $('recordList').innerHTML=rows.length?rows.map(r=>`<div class="record"><strong>${safe(r.event)}</strong><p>${dateText(r.start)} – ${dateText(r.end)} ｜ ${safe(r.type)}：${safe(r.space)}</p><p>${safe(r.company||'主辦單位未提供')}</p>${(r.source_url || (isArena() && ARENA_SOURCES[r.type]))?`<p><a href="${safe(r.source_url || ARENA_SOURCES[r.type])}" target="_blank" rel="noopener noreferrer">${isArena()?'小巨蛋官方資料來源':'官方活動來源'}</a>${isArena()&&r.source_file?` <span class="record-source-file">(${safe(r.source_file)})</span>`:''}</p>`:''}</div>`).join(''):'<p class="hint">這個日期／月份沒有已收錄紀錄（不代表沒有活動）</p>';
 requestAnimationFrame(resizeRecordPanel);
}
function renderCalendar(){const [y,m]=(previewMonth && previewMonth !== 'all' ? previewMonth : selectedMonth).split('-').map(Number),days=new Date(y,m,0).getDate(),first=new Date(y,m-1,1).getDay();$('calendarMonth').textContent=`${y} 年 ${m} 月`;
 const cal=$('calendar');cal.replaceChildren();
 // 尚未選擇場館：月曆只顯示一個置中的 '-'。
 if (!currentVenue) {
   cal.classList.remove('calendar-unavailable');
   cal.classList.add('calendar-awaiting-selection');
   cal.textContent = '-';
   $('calendarMonth').textContent = '';
   $('calendarHint').style.visibility = 'hidden';
   return;
 }
 cal.classList.remove('calendar-awaiting-selection');
 $('calendarHint').style.visibility = '';
 // 只有已收錄該場館活動／租用紀錄的月份可查詢；其他月份顯示未開放
const isAvailableMonth =
    (previewMonth && previewMonth !== 'all' ? previewMonth : selectedMonth)  >= '2025-10' &&
    (previewMonth && previewMonth !== 'all' ? previewMonth : selectedMonth)  <= '2026-10';

if (!isAvailableMonth || !monthHasRecords(previewMonth && previewMonth !== 'all' ? previewMonth : selectedMonth)) {
    cal.classList.add('calendar-unavailable');

    cal.innerHTML = `
        <div class="calendar-unavailable-message">
            尚未開放查詢
        </div>
    `;

    $('calendarHint').textContent =
        isArena()?'藍色日期＝已收錄空間租用紀錄；非完整可借用檔期。':'藍色日期＝已收錄官方公告活動；未標示不代表沒有活動。';

    return;
}

cal.classList.remove('calendar-unavailable');
 ['日','一','二','三','四','五','六'].forEach(w=>{const d=document.createElement('span');d.className='weekday';d.textContent=w;cal.appendChild(d)});
 for(let i=0;i<first;i++){const d=document.createElement('span');d.className='day empty';cal.appendChild(d)}
 for(let day=1;day<=days;day++){const key=`${y}${String(m).padStart(2,'0')}${String(day).padStart(2,'0')}`;const count=rentals.filter(r=>r.start<=key&&r.end>=key).length;const btn=document.createElement('button');btn.type='button';btn.className='day'+(count?' booked':'')+(selectedDay===key?' selected':'');btn.textContent=day;btn.title=count?`${count} 筆已收錄紀錄`:'沒有已收錄紀錄，不代表沒有活動';btn.addEventListener('click',()=>{selectedDay=selectedDay===key?null:key;$('monthFilter').value='all';renderCalendar();renderRecords()});cal.appendChild(btn)}
 $('calendarHint').textContent=isArena()?'藍色日期＝已收錄空間租用紀錄；非完整可借用檔期。':'藍色日期＝已收錄官方公告活動；未標示不代表沒有活動。';
}
function changeMonth(offset){previewMonth=null;const [y,m]=selectedMonth.split('-').map(Number);const next=new Date(y,m-1+offset,1);selectedMonth=`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}`;selectedDay=null;renderCalendar();renderRecords()}
$('prevMonth').addEventListener('click',()=>changeMonth(-1));$('nextMonth').addEventListener('click',()=>changeMonth(1));
$('monthFilter').addEventListener('change',()=>{previewMonth=null;selectedDay=null;const value=$('monthFilter').value;if(value!=='all')selectedMonth=value;renderCalendar();renderRecords()});
// 點擊每月紀錄數長條或每月不同活動數折線上的資料點，連動左側日曆。
function jumpToChartMonth(params) {
  if (!currentVenue || !dataLoaded || params.componentType !== 'series') return;
  const month = REPORT_MONTHS[params.dataIndex];
  if (!month) return;
  selectedMonth = month;
  selectedDay = null;
  previewMonth = null;
  // 有資料的月份同步篩選活動列表；沒有資料的月份則顯示「尚未開放查詢」。
  const select = $('monthFilter');
  select.value = monthHasRecords(month) ? month : 'all';
  const trigger = document.querySelector('.month-picker-trigger');
  if (trigger) trigger.textContent = (select.selectedOptions[0]?.textContent ?? '全部月份') + ' ▾';
  renderCalendar();
  renderRecords();
}
chart1.on('click', jumpToChartMonth);
chart3.on('click', jumpToChartMonth);
// 兩種資料分開載入：小巨蛋空間租用資料與其他 11 個場館官方活動公告。
function renderCharts(){
  if(!dataLoaded || !currentVenue)return;
  const data=rentals;
  const months=REPORT_MONTHS;
 chart1.setOption({tooltip:{trigger:'axis'},grid:{left:35,right:8,top:10,bottom:48},xAxis:{type:'category',data:months.map(m=>m.slice(2).replace('-','/')),axisLabel:{color:'#287e9b',fontSize:9,interval:1,rotate:35}},yAxis:{type:'value',minInterval:1,axisLabel:{color:'#287e9b'},splitLine:{lineStyle:{color:'#decf65'}}},series:[{type:'bar',data:months.map(m=>data.filter(r=>monthText(r.start)===m).length),itemStyle:{color:'#4eb0ce',borderRadius:[4,4,0,0]}}]});
 
// 星期分布：同一活動在同一天租用不同空間，只算一個活動日。
  // 依已收錄起訖日逐日展開；小巨蛋為租用日，其他場館為公告活動日期區間。
  const weekdays = ['週一','週二','週三','週四','週五','週六','週日'];
  const weekdayCounts = Array(7).fill(0);
  const seenEventDays = new Set();
  const minDate = Date.UTC(2025,9,1), maxDate = Date.UTC(2026,9,27);
  data.forEach(r => {
    const s=String(r.start??''), e=String(r.end??r.start??'');
    if(!/^\d{8}$/.test(s) || !/^\d{8}$/.test(e)) return;
    const begin=Date.UTC(+s.slice(0,4),+s.slice(4,6)-1,+s.slice(6,8));
    const finish=Date.UTC(+e.slice(0,4),+e.slice(4,6)-1,+e.slice(6,8));
    if(!Number.isFinite(begin)||!Number.isFinite(finish)||finish<begin) return;
    for(let t=Math.max(begin,minDate);t<=Math.min(finish,maxDate);t+=86400000){
      const date=new Date(t);
      const key=String(r.event??'').trim()+'|'+date.toISOString().slice(0,10);
      if(seenEventDays.has(key)) continue;
      seenEventDays.add(key);
      weekdayCounts[(date.getUTCDay()+6)%7]++;
    }
  });
  const colors=['#237E9C','#2A86A4','#3190AE','#389AB8','#3FA4C1','#FFB64D','#FF9E49'];
  chart2.setOption({
    animationDuration:650,
    color:colors,
    tooltip:{
      trigger:'item',appendToBody:true,confine:false,
      extraCssText:'z-index:9999;',
      formatter:p=>`${p.name}<br/>${isArena()?'租用活動日':'活動日'}：<b>${p.value}</b><br/>比例：${p.percent}%`
    },
    legend:{show:false},
    series:[{
      name:'星期活動分布',type:'pie',
      radius:['43%','73%'],center:['50%','50%'],
      avoidLabelOverlap:true,
      label:{show:false},
      labelLine:{show:false},
      emphasis:{scale:true,scaleSize:5},
      itemStyle:{borderWidth:1,borderColor:'#ffeb59'},
      data:weekdays.map((name,i)=>({name,value:weekdayCounts[i],itemStyle:{color:colors[i]}}))
    }]
  },true);

  // 右下折線圖：各月份以「不重複活動名稱」計算，不把同活動多筆租用紀錄當作多場。
  // 固定呈現 2025 年 10 月至 2026 年 10 月，即使某月沒有紀錄也保留 0。
  const eventMonths = REPORT_MONTHS;
  const monthlyUniqueEvents = eventMonths.map(month =>
    new Set(data.filter(r => monthText(r.start) === month).map(r => String(r.event ?? '').trim()).filter(Boolean)).size
  );
  chart3.setOption({
    animationDuration: 650,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: '#237e9c', type: 'dashed' } },
      formatter: params => {
        const point = params[0];
        return `${point.axisValue}<br/>不同活動數：<b>${point.value}</b>`;
      }
    },
    grid: { left: 38, right: 16, top: 25, bottom: 42, containLabel: false },
    xAxis: {
      type: 'category', boundaryGap: false,
      data: eventMonths.map(month => month.slice(2).replace('-','/')),
      axisLabel: { color: '#237e9c', fontSize: 9, fontWeight: 'bold', interval: 1, rotate: 35 },
      axisLine: { lineStyle: { color: '#237e9c' } }, axisTick: { show: false }
    },
    yAxis: {
      type: 'value', min: 0, minInterval: 1,
      axisLabel: { color: '#237e9c', fontSize: 11 },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#decf65', type: 'dashed' } }
    },
    series: [{
      name: '不同活動數', type: 'line', smooth: 0.25,
      data: monthlyUniqueEvents, symbol: 'circle', symbolSize: 9,
      showSymbol: true,
      lineStyle: { color: '#4eb0ce', width: 3 },
      itemStyle: { color: '#4eb0ce', borderWidth: 0 },
      emphasis: { scale: 1.4 },
      areaStyle: { color: 'rgba(78,176,206,0.13)' }
    }]
  });

  chart1.resize();chart2.resize();chart3.resize();
}
Promise.all([
  fetch('rentals.json').then(r=>{if(!r.ok)throw Error('rentals.json HTTP '+r.status);return r.json()}),
  fetch('events.json').then(r=>{if(!r.ok)throw Error('events.json HTTP '+r.status);return r.json()})
]).then(([arena,events])=>{
  arenaRentals=arena;
  venueEvents=events;
  dataLoaded=true;
  const select=$('monthFilter');
  for(const m of REPORT_MONTHS){const opt=document.createElement('option');opt.value=m;opt.textContent=m;select.appendChild(opt)}
  setupMonthPreview();
  if(currentVenue)applyVenueData();
  else {showVenue();renderCalendar();renderRecords()}
  setTimeout(()=>{chart1.resize();chart2.resize();chart3.resize();map.resize()},100);
}).catch(err=>{
  console.error('資料載入失敗',err);
  $('recordList').textContent='資料載入失敗：請使用 Live Server，並確認 rentals.json、events.json 位於同一資料夾。'+err.message;
  renderCalendar();
});
window.addEventListener('resize',()=>{chart1.resize();chart2.resize();chart3.resize();map.resize()});
window.addEventListener('load',()=>setTimeout(()=>{chart1.resize();chart2.resize();chart3.resize();map.resize()},300));

// 初始頁面：尚未選擇場館時，統計圖表各顯示一個破折號。
document.body.classList.add('dashboard-awaiting-venue');
// 初始頁面：等待使用者點選場館，圖表與月曆仍正常顯示。
showVenue();
