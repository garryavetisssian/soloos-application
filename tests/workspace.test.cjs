const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { randomUUID } = require('node:crypto');
function loader(mocks = {}) {
  const cache = new Map();
  function load(file) {
    file = path.resolve(file); if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const req = key => {
      if (key in mocks) return mocks[key];
      if (key.startsWith('@/') || key.startsWith('.')) return load(path.resolve(key.startsWith('@/') ? process.cwd() : path.dirname(file), key.startsWith('@/') ? key.slice(2) : key) + '.ts');
      return require(key);
    };
    vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename: file })(req, mod, mod.exports);
    return mod.exports;
  }
  return load;
}
const model = loader()('lib/workspace/model.ts');
test('CV and application validators reject unsafe input and preserve legacy notes', () => {
  assert.equal(model.CvDocument.safeParse({ ...model.blankCv(), portfolio_url: 'javascript:alert(1)' }).success, false);
  assert.equal(model.Application.safeParse({ ...model.blankApplication(), company: 'Acme', position: 'Designer', follow_up: '2026-02-30' }).success, false);
  const old = model.decodeApplication({ id:'id', company:'Acme', position:'Designer', notes:'Call recruiter', link:'javascript:bad', status:'saved', created_at:'' });
  assert.equal(old.notes, 'Call recruiter'); assert.equal(old.link, '');
  assert.equal(model.decodeCv({ id:'id', title:'Old', summary:'Original summary', language:'ru', created_at:'' }).document.summary,'Original summary');
});
function harness() {
  const owner = randomUUID(), other = randomUUID();
  const rows = { resumes: [], jobs: [], saved_cover_letters: [] };
  let signedIn = true;
  const db = { auth: { getUser: async () => ({ data: { user: signedIn ? { id:owner } : null }, error:null }) }, from(table) {
    let op='read', payload, filters=[];
    const q = {
      select(){return q;}, eq(k,v){filters.push([k,v]);return q;}, order(){return q;}, limit(){return q;},
      insert(v){op='insert';payload=v;return q;},update(v){op='update';payload=v;return q;},delete(){op='delete';return q;},
      execute(single=false){ let found=rows[table].filter(r=>filters.every(([k,v])=>r[k]===v));
        if(op==='insert'){const r={id:randomUUID(),created_at:new Date().toISOString(),...payload};rows[table].push(r);found=[r];}
        if(op==='update')found.forEach(r=>Object.assign(r,payload));
        if(op==='delete')rows[table]=rows[table].filter(r=>!found.includes(r));
        return {data:single?(found[0]||null):found,error:null};
      }, maybeSingle(){return Promise.resolve(q.execute(true));},then(resolve,reject){return Promise.resolve(q.execute()).then(resolve,reject);}
    }; return q;
  }};
  const api=loader({ '@/lib/supabase/server': {createClient:async()=>db} })('lib/workspace/server.ts').workspaceRequest;
  return { rows, owner, other, logout:()=>signedIn=false, api:(kind,method,body,id)=>api(kind,new Request('http://localhost/api/workspace/'+kind,{method,body:body===undefined?undefined:JSON.stringify(body)}),id) };
}
test('CV create/read/update/delete works, with ownership and strict input checks', async () => {
  const h=harness(), cv={...model.blankCv(),full_name:'Jane Smith',experience:'Designed a product.'};
  let res=await h.api('cvs','POST',cv);assert.equal(res.status,201);let row=await res.json();
  assert.equal(row.document.experience,cv.experience);assert.equal(h.rows.resumes[0].user_id,h.owner);
  res=await h.api('cvs','PUT',{...cv,title:'Updated'},row.id);assert.equal((await res.json()).document.title,'Updated');
  const foreign={id:randomUUID(),user_id:h.other,title:'Private',summary:'Secret',language:'en',created_at:''};h.rows.resumes.push(foreign);
  assert.equal((await h.api('cvs','GET')).status,200);
  assert.equal((await (await h.api('cvs','GET')).json()).length,1);
  for(const method of ['GET','PUT','DELETE'])assert.equal((await h.api('cvs',method,method==='PUT'?cv:undefined,foreign.id)).status,404);
  assert.equal(foreign.title,'Private');
  assert.equal((await h.api('cvs','POST',{...cv,user_id:h.other})).status,400);
  assert.equal((await h.api('cvs','DELETE',undefined,row.id)).status,200);
  h.logout();assert.equal((await h.api('cvs','GET')).status,401);
});
test('Applications preserve statuses, follow-ups and notes, and reject foreign letters', async () => {
 const h=harness(), ownLetter=randomUUID(), foreignLetter=randomUUID();
 h.rows.saved_cover_letters.push({id:ownLetter,user_id:h.owner},{id:foreignLetter,user_id:h.other});
 const job={...model.blankApplication(),company:'Acme',position:'Engineer',follow_up:'2026-10-10',notes:'Discuss next steps',letter_id:ownLetter};
 assert.equal((await h.api('jobs','POST',{...job,letter_id:foreignLetter})).status,400);
 const res=await h.api('jobs','POST',job);assert.equal(res.status,201);const row=await res.json();
 assert.equal(row.follow_up,job.follow_up);assert.equal(row.letter_id,ownLetter);assert.equal(row.version,undefined);
 for(const status of model.JOB_STATES){const r=await h.api('jobs','PUT',{...job,status},row.id);assert.equal(r.status,200);assert.equal((await r.json()).status,status);}
 const foreign={...h.rows.jobs[0],id:randomUUID(),user_id:h.other};h.rows.jobs.push(foreign);
 for(const method of ['GET','PUT','DELETE'])assert.equal((await h.api('jobs',method,method==='PUT'?job:undefined,foreign.id)).status,404);
 assert.equal((await h.api('jobs','DELETE',undefined,row.id)).status,200);
 assert.equal((await h.api('jobs','POST',{...job,status:'unknown'})).status,400);
});
test('PDF export supports English, Russian and Armenian text and pagination', async () => {
 const {buildCvPdf}=loader()('lib/export/cv-pdf.ts');
 const parse=require('pdf-parse/lib/pdf-parse.js');
 for(const [language,name] of [['en','Jane Smith'],['ru','Анна Иванова'],['hy','Աննա Սարգսյան']]){
  const pdf=await buildCvPdf({...model.blankCv(),language,full_name:name,experience:'Built a product.\n'.repeat(500)});
  assert.equal(pdf.subarray(0,4).toString(),'%PDF');const result=await parse(pdf);assert.ok(result.numpages>1);assert.ok(result.text.includes(name),`${language}: ${result.text.slice(0,180)}`);assert.ok(result.text.includes('Built a product.'));
 }
});
