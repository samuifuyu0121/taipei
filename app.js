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
let currentVenue=venues[0],rentals=[],selectedDay=null,selectedMonth='2026-05';
const $=id=>document.getElementById(id);
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateText=s=>`${s.slice(0,4)}/${s.slice(4,6)}/${s.slice(6,8)}`;
const monthText=s=>`${s.slice(0,4)}-${s.slice(4,6)}`;
const chart1=echarts.init($('monthly')),chart2=echarts.init($('types'));
function focusVenue(v,coords){currentVenue=v;selectedDay=null;showVenue();renderRecords();renderCalendar();map.flyTo({center:coords,zoom:16.5,pitch:65,bearing:-25,duration:1600});}
function showVenue(){
 $('venueTitle').textContent=currentVenue.name;
 $('venueInfo').innerHTML=`<p><strong>${safe(currentVenue.type)}</strong> · ${safe(currentVenue.address)}</p><p>${currentVenue.hasData?'已匯入 2026 年 5–9 月空間租用紀錄':'尚未匯入此場館的租用紀錄；下方仍顯示小巨蛋資料作為參考。'}</p>`;
 $('recordHeading').textContent=currentVenue.hasData?'小巨蛋租用紀錄':'小巨蛋租用紀錄（參考）';
}
function makePopup(v){const node=document.createElement('div');const title=document.createElement('h3');title.textContent=v.name;const address=document.createElement('p');address.textContent=v.address;const note=document.createElement('p');note.textContent=v.hasData?'已有小巨蛋租用資料':'租用資料尚未匯入';node.append(title,address,note);return new mapboxgl.Popup({offset:25}).setDOMContent(node);}
function placeMarker(v,coords){const marker=new mapboxgl.Marker({color:v.hasData?'#f04f5c':'#27a9d2'}).setLngLat(coords).setPopup(makePopup(v)).addTo(map);marker.getElement().addEventListener('click',()=>focusVenue(v,coords));}
placeMarker(venues[0],ARENA);
// 其餘場館使用 Mapbox Geocoding 查詢；定位結果為近似地址位置，須人工核對。
async function loadVenueMarkers(){for(const v of venues.slice(1))try{
 const url=`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(v.address)}.json?country=tw&limit=1&access_token=${encodeURIComponent(mapboxgl.accessToken)}`;
 const res=await fetch(url);if(!res.ok)throw Error(`HTTP ${res.status}`);const json=await res.json();const coords=json.features?.[0]?.center;
 if(!coords){console.warn('找不到場館',v.name);continue;}placeMarker(v,coords);
}catch(e){console.warn('場館定位失敗',v.name,e);}}
map.on('load',loadVenueMarkers);
$('overviewBtn').addEventListener('click',()=>map.flyTo({...OVERVIEW,duration:1600}));
$('arenaBtn').addEventListener('click',()=>focusVenue(venues[0],ARENA));
function renderRecords(){let rows=rentals.slice();const filter=$('monthFilter').value;
 if(filter!=='all')rows=rows.filter(r=>monthText(r.start)===filter);
 if(selectedDay){rows=rows.filter(r=>r.start<=selectedDay&&r.end>=selectedDay);$('recordHeading').textContent=`${dateText(selectedDay)} 租用紀錄`;}else $('recordHeading').textContent=currentVenue.hasData?'小巨蛋租用紀錄':'小巨蛋租用紀錄（參考）';
 rows.sort((a,b)=>b.start.localeCompare(a.start));
 $('recordList').innerHTML=rows.length?rows.map(r=>`<div class="record"><strong>${safe(r.event)}</strong><p>${dateText(r.start)} – ${dateText(r.end)} ｜ ${safe(r.type)}：${safe(r.space)}</p><p>${safe(r.company)}</p></div>`).join(''):'<p class="hint">這個日期／月份沒有租用紀錄</p>';
}
function renderCalendar(){const [y,m]=selectedMonth.split('-').map(Number),days=new Date(y,m,0).getDate(),first=new Date(y,m-1,1).getDay();$('calendarMonth').textContent=`${y} 年 ${m} 月`;
 const cal=$('calendar');cal.replaceChildren();['日','一','二','三','四','五','六'].forEach(w=>{const d=document.createElement('span');d.className='weekday';d.textContent=w;cal.appendChild(d)});
 for(let i=0;i<first;i++){const d=document.createElement('span');d.className='day empty';cal.appendChild(d)}
 for(let day=1;day<=days;day++){const key=`${y}${String(m).padStart(2,'0')}${String(day).padStart(2,'0')}`;const count=rentals.filter(r=>r.start<=key&&r.end>=key).length;const btn=document.createElement('button');btn.type='button';btn.className='day'+(count?' booked':'')+(selectedDay===key?' selected':'');btn.textContent=day;btn.title=count?`${count} 筆空間租用紀錄`:'沒有匯入的租用紀錄';btn.addEventListener('click',()=>{selectedDay=selectedDay===key?null:key;$('monthFilter').value='all';renderCalendar();renderRecords()});cal.appendChild(btn)}
 $('calendarHint').textContent='藍色日期＝CSV 有空間租用紀錄；不代表整座場館檔期或可預約狀態。';
}
function changeMonth(offset){const [y,m]=selectedMonth.split('-').map(Number);const next=new Date(y,m-1+offset,1);selectedMonth=`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}`;selectedDay=null;renderCalendar();renderRecords()}
$('prevMonth').addEventListener('click',()=>changeMonth(-1));$('nextMonth').addEventListener('click',()=>changeMonth(1));
$('monthFilter').addEventListener('change',()=>{selectedDay=null;const value=$('monthFilter').value;if(value!=='all')selectedMonth=value;renderCalendar();renderRecords()});
fetch('rentals.json').then(r=>{if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()}).then(data=>{
 rentals=data;$('total').textContent=data.length;$('events').textContent=new Set(data.map(r=>r.event)).size;
 const months=[...new Set(data.map(r=>monthText(r.start)))].sort();selectedMonth=months[0]??selectedMonth;
 for(const m of months){const opt=document.createElement('option');opt.value=m;opt.textContent=m;$('monthFilter').appendChild(opt)}
 chart1.setOption({tooltip:{trigger:'axis'},grid:{left:35,right:8,top:10,bottom:26},xAxis:{type:'category',data:months,axisLabel:{color:'#287e9b',fontSize:10}},yAxis:{type:'value',minInterval:1,axisLabel:{color:'#287e9b'},splitLine:{lineStyle:{color:'#decf65'}}},series:[{type:'bar',data:months.map(m=>data.filter(r=>monthText(r.start)===m).length),itemStyle:{color:'#4eb0ce',borderRadius:[4,4,0,0]}}]});
 const types=['主場館活動使用空間','廣場'];chart2.setOption({tooltip:{trigger:'item'},legend:{bottom:0,textStyle:{color:'#287e9b',fontSize:10}},series:[{type:'pie',radius:['35%','64%'],center:['50%','43%'],label:{color:'#287e9b',fontSize:10},data:types.map((t,i)=>({name:t,value:data.filter(r=>r.type===t).length,itemStyle:{color:['#4eb0ce','#ff9e49'][i]}}))}]});
 showVenue();renderCalendar();renderRecords();setTimeout(()=>{chart1.resize();chart2.resize();map.resize()},100);
}).catch(err=>{$('recordList').textContent='資料載入失敗：請使用 Live Server 並確認 rentals.json 位於同一資料夾。'+err.message;renderCalendar()});
window.addEventListener('resize',()=>{chart1.resize();chart2.resize();map.resize()});
window.addEventListener('load',()=>setTimeout(()=>{chart1.resize();chart2.resize();map.resize()},300));
