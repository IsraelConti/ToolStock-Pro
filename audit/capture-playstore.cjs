const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

// Isolated browser contexts: these fixtures never touch a customer's inventory,
// account, subscription, Drive, or the installed Android application.
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'store-captures');
const date = offset => {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const stamp = new Date().toISOString();
const products = [
  ['p1','ROD-6204','Rodamiento 6204 2RS',24,6,8.5,'Rodamientos','A-01','high',7],
  ['p2','COR-A42','Correa de transmisión A42',8,4,12,'Transmisión','A-02','high',10],
  ['p3','JUN-EPDM','Junta EPDM para bomba',2,5,4.8,'Estanqueidad','B-01','critical',14],
  ['p4','SEN-M12','Sensor inductivo M12',6,2,28,'Instrumentación','C-03','high',5],
  ['p5','FILT-025','Filtro de aire 25 micras',3,4,16,'Neumática','B-04','medium',7],
  ['p6','FUS-10A','Fusible 10 A',30,10,1.9,'Electricidad','C-01','medium',3],
].map(([id,reference,name,stock,minimumStock,unitPrice,category,location,criticality,leadTimeDays])=>({id,reference,name,stock,minimumStock,unitPrice,category,location,criticality,leadTimeDays,unit:'unidades',warehouse:'Almacén del taller',equipment:'Línea de envasado',createdAt:stamp,updatedAt:stamp}));
const movements = [
  {id:'m1',productId:'p1',productName:products[0].name,reference:'ROD-6204',type:'entry',quantity:10,delta:10,stockBefore:14,stockAfter:24,responsible:'Técnico de turno',destination:'Reposición de almacén',unit:'unidades',createdAt:stamp},
  {id:'m2',productId:'p3',productName:products[2].name,reference:'JUN-EPDM',type:'consumption',quantity:2,delta:-2,stockBefore:4,stockAfter:2,responsible:'Mantenimiento',destination:'Cambio de junta de bomba',equipment:'OT-024',unit:'unidades',createdAt:stamp},
];
const equipment = [
  {id:'e1',name:'Compresor principal',code:'EQ-001',category:'Servicios',manufacturer:'Equipo de ejemplo',model:'CP-15',site:'Planta principal',area:'Servicios auxiliares',location:'Sala de compresores',criticality:'Alta',status:'Operativo',responsible:'Mantenimiento',hours:4200,createdAt:stamp,updatedAt:stamp},
  {id:'e2',name:'Bomba de proceso',code:'EQ-002',category:'Producción',manufacturer:'Equipo de ejemplo',model:'BP-40',site:'Planta principal',area:'Línea 1',location:'Zona de proceso',criticality:'Crítica',status:'En reparación',responsible:'Técnico de turno',hours:1860,createdAt:stamp,updatedAt:stamp},
  {id:'e3',name:'Cinta de envasado',code:'EQ-003',category:'Envasado',site:'Planta principal',area:'Línea 2',location:'Final de línea',criticality:'Media',status:'Operativo',responsible:'Mantenimiento',hours:3120,createdAt:stamp,updatedAt:stamp},
];
const orders = [
  {id:'o1',equipmentId:'e2',description:'Fuga en el sello de la bomba',priority:'Alta',status:'En curso',technician:'Técnico de turno',dueDate:date(1),impact:'Equipo aislado para revisión',type:'Correctivo',createdAt:stamp,updatedAt:stamp,closedAt:''},
  {id:'o2',equipmentId:'e1',description:'Comprobar vibración del compresor',priority:'Normal',status:'Pendiente',technician:'Mantenimiento',dueDate:date(3),type:'Correctivo',createdAt:stamp,updatedAt:stamp,closedAt:''},
  {id:'o3',equipmentId:'e3',description:'Ajustar alineación de la cinta',priority:'Normal',status:'Finalizada',technician:'Mantenimiento',dueDate:date(-1),type:'Correctivo',createdAt:stamp,updatedAt:stamp,closedAt:stamp,resolution:'Alineación y tensión revisadas. Prueba de funcionamiento correcta.',parts:'Sin sustituciones',laborHours:1.5,laborCost:42,partsCost:0},
];
const plans = [
  {id:'pl1',equipmentId:'e1',title:'Revisar filtros y nivel de aceite',frequency:'30',nextDate:date(1),technician:'Mantenimiento',createdAt:stamp,updatedAt:stamp},
  {id:'pl2',equipmentId:'e2',title:'Inspeccionar sellos y fugas',frequency:'7',nextDate:date(2),technician:'Técnico de turno',createdAt:stamp,updatedAt:stamp},
  {id:'pl3',equipmentId:'e3',title:'Revisar tensión y protecciones',frequency:'15',nextDate:date(5),technician:'Mantenimiento',createdAt:stamp,updatedAt:stamp},
];
const mime = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};

async function openApp(browser, app, format) {
  const mobile = format === 'phone';
  const context = await browser.newContext({viewport:mobile?{width:360,height:640}:{width:1280,height:720},deviceScaleFactor:mobile?3:1.5,locale:'es-ES',colorScheme:'dark'});
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const assets = app==='toolstock' ? path.join(root,'dist') : path.join(root,'audit','store-fixtures','maintenpro');
  await page.route('https://capture.invalid/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith('/oauth/')) return route.fulfill({status:401,contentType:'application/json',body:'{"configured":false,"linked":false}'});
    const file = path.join(assets, url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
    try { await route.fulfill({status:200,body:await fs.readFile(file),contentType:mime[path.extname(file)]||'application/octet-stream'}); }
    catch { await route.fulfill({status:404,body:''}); }
  });
  await page.addInitScript(({app,products,movements,equipment,orders,plans,stamp}) => {
    if(app==='toolstock') {
      const values = {
        'toolstock.products.v1':products,'toolstock.movements.v1':movements,'toolstock.employees.v1':[],
        'toolstock.owner.v1':{email:'taller@example.com',displayName:'Taller de ejemplo'},
        'toolstock.settings.v1':{appName:'ToolStock Pro: Repuestos',companyName:'Taller de ejemplo',language:'es',currency:'EUR',tax:21,theme:'dark',negativeStock:false,hidePrices:false,updatedAt:stamp},
      };
      for(const [key,value] of Object.entries(values))localStorage.setItem(key,JSON.stringify(value));
    } else {
      sessionStorage.setItem('maintenpro.reviewAccess','1');
      sessionStorage.setItem('maintenpro.state.v3',JSON.stringify({version:2,equipment,orders,plans,team:[],conflicts:[],settings:{appName:'MaintenPro',companyName:'Taller de ejemplo',ownerEmail:'taller@example.com',language:'es',currency:'EUR',tax:21,alertDays:7,urgentDays:2,notifications:true}}));
    }
  }, {app,products,movements,equipment,orders,plans,stamp});
  await page.goto('https://capture.invalid/',{waitUntil:'networkidle'});
  await page.locator('.screen.active[data-screen="home"]').waitFor();
  await page.evaluate(()=>document.fonts.ready);
  return {context,page,errors};
}

async function run() {
  await fs.mkdir(output,{recursive:true});
  const browser = await chromium.launch({args:['--no-sandbox']}); const manifest=[];
  try {
    for(const app of ['toolstock','maintenpro'])for(const format of ['phone','tablet']) {
      const {context,page,errors}=await openApp(browser,app,format);
      const screens=app==='toolstock'
        ? [['01-panel','home'],['02-repuestos','products'],['03-movimientos','movements'],['04-ficha','productForm'],['05-informes','reports'],['06-etiquetas-qr','qr'],['07-diagnostico','assistant'],['08-lupa','products']]
        : [['01-panel','home'],['02-equipos','equipment'],['03-ordenes','orders'],['04-preventivos','plans'],['05-calendario','calendar'],['06-informes','reports'],['07-sr-alicate','assistant'],['08-detalle-orden','orderDetail']];
      for(const [name,screen] of (format==='phone'?screens:screens.filter((_,i)=>[0,1,2,6].includes(i)))) {
        if(app==='toolstock') {
          await page.evaluate(screen=>{
            const nav=document.querySelector('[data-go="'+screen+'"],[data-industrial-go="'+screen+'"]');
            if(!nav)throw new Error('Missing real navigation for '+screen);nav.click();
          },screen);
          if(name==='04-ficha') {
            for(const [key,value] of Object.entries({name:'Rodamiento 6204 2RS',reference:'ROD-6204',manufacturer:'Equipo de ejemplo',oemReference:'6204-2RS',stock:'24',minimumStock:'6'}))await page.locator('#productForm [name="'+key+'"]').fill(value);
          }
          if(name==='07-diagnostico')await page.locator('[data-ai="critical"]').click();
          if(name==='08-lupa') {await page.locator('#lupaLauncher').click();await page.locator('#lupaQuestion').fill('cómo registro una salida');}
        } else {
          await page.evaluate(({screen})=>window.MaintenProNavigate(screen,screen==='orderDetail'?'o1':undefined),{screen});
          if(name==='07-sr-alicate') {
            const input=page.locator('#alicateGuideQuery');
            if(await input.count()) {await input.fill('Cómo crear una orden');await input.dispatchEvent('input');}
          }
        }
        await page.waitForTimeout(350);
        assert.equal(await page.locator('.screen.active').getAttribute('data-screen'),screen);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`${app}/${format}/${name}: horizontal overflow`);
        const dir=path.join(output,app,format);await fs.mkdir(dir,{recursive:true});
        const filename=path.join(dir,`${app}-${name}.png`);
        await page.screenshot({path:filename,fullPage:false,omitBackground:false,animations:'disabled'});
        manifest.push({app,format,screen,file:path.relative(output,filename),width:format==='phone'?1080:1920,height:format==='phone'?1920:1080,provenance:'Captured from the actual embedded app assets; isolated sample data; no customer data.'});
      }
      assert.deepEqual(errors,[],`${app}/${format}: JS errors`);await context.close();
    }
  } finally { await browser.close(); }
  await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),toolstockCommit:process.env.GITHUB_SHA||'',maintenproSource:'Embedded assets from signed AAB 1.2.9.1 code 13 R3',captures:manifest},null,2));
  console.log(`PASS: ${manifest.length} actual app captures; no horizontal overflow or JavaScript exceptions.`);
}
run().catch(error=>{console.error(error.stack||error);process.exitCode=1});
