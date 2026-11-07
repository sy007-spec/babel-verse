#!/usr/bin/env python3
"""Babelverse-only operations. Never manages sibling applications."""
import argparse, datetime, fcntl, json, os, pathlib, secrets, shutil, subprocess, urllib.request, time
ROOT=pathlib.Path(__file__).resolve().parent
os.chdir(ROOT)
def run(*args, **kw): return subprocess.run(args,check=True,**kw)
def compose(*args,**kw): return run('docker','compose',*args,**kw)
def initialize():
    for d in ['runtime','runtime/export','runtime/geoip','runtime/evidence','backups']:(ROOT/d).mkdir(exist_ok=True)
    os.chmod('runtime',0o700)
    if not pathlib.Path('.env').exists():
        pw=secrets.token_hex(32); identity=secrets.token_hex(32)
        pathlib.Path('.env').write_text('POSTGRES_PASSWORD='+pw+'\n')
        base=f'DATABASE_URL=postgresql://babelverse:{pw}@db:5432/babelverse\nREDIS_URL=redis://redis:6379\nIDENTITY_SECRET={identity}\nPUBLIC_ORIGIN=https://babelverse.seii.top\n'
        pathlib.Path('runtime/web.env').write_text(base+'OIDC_ISSUER=https://zitadel.seii.top\nOIDC_CLIENT_ID=\nOIDC_CLIENT_SECRET=\nGEOIP_DATABASE=/geoip/country.mmdb\n')
        pathlib.Path('runtime/worker.env').write_text(base+'LLM_BASE_URL=\nLLM_API_KEY=\nLLM_MODEL=\nLLM_DAILY_CALL_LIMIT=200\n')
        for p in ['.env','runtime/web.env','runtime/worker.env']:os.chmod(p,0o600)
    # Writable container export volume; evidence is read-only to the worker.
    run('sudo','chown','1000:1000','runtime/export')
def backup():
    out=ROOT/'backups'/datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ');out.mkdir(parents=True);os.chmod(out,0o700)
    with open(out/'database.sql','wb') as f:compose('exec','-T','db','pg_dump','-U','babelverse','--no-owner','babelverse',stdout=f)
    for p in ['.env','runtime/web.env','runtime/worker.env']:shutil.copy2(p,out/pathlib.Path(p).name)
    (out/'version').write_text(subprocess.check_output(['git','rev-parse','HEAD'],text=True));print('Backup:',out)
def export():
    lock=open('runtime/export.lock','w');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    compose('exec','-T','worker','npx','tsx','scripts/export.ts')
    repo=ROOT/'runtime'/'mirror'
    if not repo.exists():run('git','clone','--branch','main','git@github.com:sy007-spec/babel-verse.git',str(repo))
    run('git','-C',str(repo),'pull','--ff-only','origin','main')
    target=repo/'catalog'
    if target.exists():shutil.rmtree(target)
    shutil.copytree('runtime/export/catalog',target)
    run('git','-C',str(repo),'add','--','catalog')
    changed=subprocess.run(['git','-C',str(repo),'diff','--cached','--quiet']).returncode
    if changed==1:
        run('git','-C',str(repo),'-c','user.name=babelverse archive','-c','user.email=babelverse@seii.top','commit','-m','data: refresh verified public poetry archive')
    elif changed!=0:raise RuntimeError('Git diff failed')
    # Also retries an earlier successful local commit whose push failed.
    run('git','-C',str(repo),'push','origin','HEAD:main')
def main():
    p=argparse.ArgumentParser();p.add_argument('action',choices=['init','build','migrate','backup','deploy','restart','health','export','review']);p.add_argument('args',nargs='*');a=p.parse_args()
    if a.action=='init':initialize()
    elif a.action=='build':compose('build','web','worker')
    elif a.action=='migrate':compose('up','-d','db','redis');compose('run','--rm','--no-deps','worker','npm','run','migrate')
    elif a.action=='backup':backup()
    elif a.action in ['deploy','restart']:
        if a.action=='deploy':backup();compose('build','web','worker')
        compose('up','-d','--no-deps','web','worker')
    elif a.action=='health':
        with urllib.request.urlopen('http://127.0.0.1:58120/api/health',timeout=15) as r:print(r.read().decode())
    elif a.action=='export':export()
    elif a.action=='review':compose('exec','-T','worker','npx','tsx','scripts/review.ts',*a.args)
if __name__=='__main__':main()
