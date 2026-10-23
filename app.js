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
 {name:'Legacy mini @ amba',address:'臺北市萬華區武昌街二段77號5樓',type:'小型音樂展演空間'}
];
let currentVenue=null,rentals=[],selectedDay=null,selectedMonth='2026-05';
let previewMonth = null; // 月份選單滑鼠預覽，不覆蓋正式選取
const $=id=>document.getElementById(id);
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateText=s=>`${s.slice(0,4)}/${s.slice(4,6)}/${s.slice(6,8)}`;
const monthText=s=>`${s.slice(0,4)}-${s.slice(4,6)}`;
const chart1=echarts.init($('monthly')),chart2=echarts.init($('types')),chart3=echarts.init($('statsChart'));
function focusVenue(v,coords){document.body.classList.remove('dashboard-awaiting-venue');currentVenue=v;selectedDay=null;showVenue();renderRecords();renderCalendar();map.flyTo({center:coords,zoom:16.5,pitch:65,bearing:-25,duration:1600});}
function showVenue(){
 if (!currentVenue) {
   venueTile?.classList.add('venue-awaiting-selection');
   $('venueTitle').textContent = '';
   $('venueInfo').textContent = '';
   return;
 }
 venueTile?.classList.remove('venue-awaiting-selection');
 $('venueTitle').textContent=currentVenue.name;
 $('venueInfo').innerHTML=`<p><strong>${safe(currentVenue.type)}</strong> · ${safe(currentVenue.address)}</p><p>${currentVenue.hasData?'已匯入 2026 年 5–9 月空間租用紀錄':'尚未匯入此場館的租用紀錄；下方仍顯示小巨蛋資料作為參考。'}</p>`;
 $('recordHeading').textContent=currentVenue.hasData?'小巨蛋租用紀錄':'小巨蛋租用紀錄（參考）';
}
function makePopup(v){const node=document.createElement('div');const title=document.createElement('h3');title.textContent=v.name;const address=document.createElement('p');address.textContent=v.address;const note=document.createElement('p');note.textContent=v.hasData?'已有小巨蛋租用資料':'租用資料尚未匯入';node.append(title,address,note);return new mapboxgl.Popup({offset:25}).setDOMContent(node);}
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
// 其餘場館使用 Mapbox Geocoding 查詢；定位結果為近似地址位置，須人工核對。
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
    const collapsed = 85;
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
    // 監聽整個頁面，不限紀錄區域；只要從右側選單向左移動就展開。
    document.addEventListener('pointermove', event => {
        if (!monthPickerActive || !currentVenue || leftwardExpanded) return;
        const picker = document.querySelector('.month-picker');
        if (!picker) return;
        const rect = picker.getBoundingClientRect();
        if (pickerPointerX === null) pickerPointerX = event.clientX;
        if (event.clientX < rect.left - 4 && event.clientX < pickerPointerX - 4) {
            leftwardExpanded = true;
            setRecordsExpanded(true);
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
    if (previewMonth === value) return;
    previewMonth = value;
    renderRecords();
    renderCalendar();
  }
  function close() {
    monthPickerActive = false;
    pickerPointerX = null;
    leftwardExpanded = false;
    picker.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
    if (previewMonth !== null) {
      previewMonth = null;
      renderRecords();
      renderCalendar();
    }
  }
  for (const option of Array.from(select.options)) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'month-picker-option';
    item.setAttribute('role', 'option');
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
  function openPicker() {
    if (!monthPickerActive) {
      monthPickerActive = true;
      pickerPointerX = picker.getBoundingClientRect().left + picker.getBoundingClientRect().width / 2;
      leftwardExpanded = false;
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
      setRecordsExpanded(false);
    }
    openPicker();
  });
  // 滑鼠往右離開月份選單時，允許直接收起，不必選擇月份。
  // 往左離開時則保持選單開啟，讓使用者查看完整紀錄。
  picker.addEventListener('pointerleave', event => {
    if (!monthPickerActive) return;
    const bounds = picker.getBoundingClientRect();
    if (event.clientX >= bounds.right - 2) {
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
 if(filter!=='all')rows=rows.filter(r=>monthText(r.start)===filter);
 if(selectedDay && previewMonth === null){rows=rows.filter(r=>r.start<=selectedDay&&r.end>=selectedDay);$('recordHeading').textContent=`${dateText(selectedDay)} 租用紀錄`;}else $('recordHeading').textContent=currentVenue.hasData?'小巨蛋租用紀錄':'小巨蛋租用紀錄（參考）';
 rows.sort((a,b)=>b.start.localeCompare(a.start));
 $('recordList').innerHTML=rows.length?rows.map(r=>`<div class="record"><strong>${safe(r.event)}</strong><p>${dateText(r.start)} – ${dateText(r.end)} ｜ ${safe(r.type)}：${safe(r.space)}</p><p>${safe(r.company)}</p></div>`).join(''):'<p class="hint">這個日期／月份沒有租用紀錄</p>';
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
 // 只開放查詢 2026 年 5 月至 9 月
const isAvailableMonth =
    (previewMonth && previewMonth !== 'all' ? previewMonth : selectedMonth) >= '2026-05' &&
    (previewMonth && previewMonth !== 'all' ? previewMonth : selectedMonth) <= '2026-09';

if (!isAvailableMonth) {
    cal.classList.add('calendar-unavailable');

    cal.innerHTML = `
        <div class="calendar-unavailable-message">
            目前並無開放該時段查詢
        </div>
    `;

    $('calendarHint').textContent =
        '藍色日期＝CSV 有空間租用紀錄；不代表整座場館檔期或可預約狀態。';

    return;
}

cal.classList.remove('calendar-unavailable');
 ['日','一','二','三','四','五','六'].forEach(w=>{const d=document.createElement('span');d.className='weekday';d.textContent=w;cal.appendChild(d)});
 for(let i=0;i<first;i++){const d=document.createElement('span');d.className='day empty';cal.appendChild(d)}
 for(let day=1;day<=days;day++){const key=`${y}${String(m).padStart(2,'0')}${String(day).padStart(2,'0')}`;const count=rentals.filter(r=>r.start<=key&&r.end>=key).length;const btn=document.createElement('button');btn.type='button';btn.className='day'+(count?' booked':'')+(selectedDay===key?' selected':'');btn.textContent=day;btn.title=count?`${count} 筆空間租用紀錄`:'沒有匯入的租用紀錄';btn.addEventListener('click',()=>{selectedDay=selectedDay===key?null:key;$('monthFilter').value='all';renderCalendar();renderRecords()});cal.appendChild(btn)}
 $('calendarHint').textContent='藍色日期＝CSV 有空間租用紀錄；不代表整座場館檔期或可預約狀態。';
}
function changeMonth(offset){previewMonth=null;const [y,m]=selectedMonth.split('-').map(Number);const next=new Date(y,m-1+offset,1);selectedMonth=`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}`;selectedDay=null;renderCalendar();renderRecords()}
$('prevMonth').addEventListener('click',()=>changeMonth(-1));$('nextMonth').addEventListener('click',()=>changeMonth(1));
$('monthFilter').addEventListener('change',()=>{previewMonth=null;selectedDay=null;const value=$('monthFilter').value;if(value!=='all')selectedMonth=value;renderCalendar();renderRecords()});
fetch('rentals.json').then(r=>{if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()}).then(data=>{
 rentals=data;const totalRecords=data.length;const uniqueEvents=new Set(data.map(r=>r.event)).size;
 const months=[...new Set(data.map(r=>monthText(r.start)))].sort();selectedMonth=months[0]??selectedMonth;
 for(const m of months){const opt=document.createElement('option');opt.value=m;opt.textContent=m;$('monthFilter').appendChild(opt)}
  setupMonthPreview();
 chart1.setOption({tooltip:{trigger:'axis'},grid:{left:35,right:8,top:10,bottom:26},xAxis:{type:'category',data:months,axisLabel:{color:'#287e9b',fontSize:10}},yAxis:{type:'value',minInterval:1,axisLabel:{color:'#287e9b'},splitLine:{lineStyle:{color:'#decf65'}}},series:[{type:'bar',data:months.map(m=>data.filter(r=>monthText(r.start)===m).length),itemStyle:{color:'#4eb0ce',borderRadius:[4,4,0,0]}}]});
 const types=['主場館活動使用空間','廣場'];chart2.setOption({tooltip:{trigger:'item',appendToBody:true,confine:false,extraCssText:'z-index:9999;',position:(point,params,dom,rect,size)=>[Math.max(8,Math.min(point[0]-size.contentSize[0]/2,size.viewSize[0]-size.contentSize[0]-8)),Math.max(8,point[1]-size.contentSize[1]-18)]},legend:{bottom:0,textStyle:{color:'#287e9b',fontSize:10}},series:[{type:'pie',radius:['35%','64%'],center:['50%','43%'],label:{color:'#287e9b',fontSize:10},data:types.map((t,i)=>({name:t,value:data.filter(r=>r.type===t).length,itemStyle:{color:['#4eb0ce','#ff9e49'][i]}}))}]});
  chart3.setOption({animationDuration:650,grid:{left:86,right:28,top:15,bottom:20},
    xAxis:{type:'value',max:v=>Math.max(10,Math.ceil(v.max/10)*10),axisLabel:{color:'#237e9c'},splitLine:{lineStyle:{color:'#decf65'}}},
    yAxis:{type:'category',data:['不同活動數','租用紀錄數'],axisLabel:{color:'#237e9c',fontSize:12,fontWeight:'bold'},axisLine:{show:false},axisTick:{show:false}},
    series:[{type:'bar',barWidth:24,data:[uniqueEvents,totalRecords],itemStyle:{color:'#4eb0ce',borderRadius:[0,4,4,0]},label:{show:true,position:'right',color:'#237e9c',fontSize:19,fontWeight:'bold'}}]});
  showVenue();renderCalendar();renderRecords();setTimeout(()=>{chart1.resize();chart2.resize();chart3.resize();map.resize()},100);
}).catch(err=>{$('recordList').textContent='資料載入失敗：請使用 Live Server 並確認 rentals.json 位於同一資料夾。'+err.message;renderCalendar()});
window.addEventListener('resize',()=>{chart1.resize();chart2.resize();chart3.resize();map.resize()});
window.addEventListener('load',()=>setTimeout(()=>{chart1.resize();chart2.resize();chart3.resize();map.resize()},300));

// 初始頁面：尚未選擇場館時，統計圖表各顯示一個破折號。
document.body.classList.add('dashboard-awaiting-venue');
// 初始頁面：等待使用者點選場館，圖表與月曆仍正常顯示。
showVenue();
