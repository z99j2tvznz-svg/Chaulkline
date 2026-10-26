import asyncio, sys
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  context=await browser.new_context(viewport={'width':1380,'height':900},accept_downloads=True)
  page=await context.new_page()
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('console',lambda m: errors.append('console: '+m.text) if m.type=='error' else None)
  await page.goto('about:blank')
  await page.set_content((ROOT/'fieldwork-standalone.html').read_text(),wait_until='load')
  await page.wait_for_timeout(300)
  await page.screenshot(path=str(ROOT/'home-desktop.png'),full_page=True)
  print('home title',await page.title(),'errors:',errors)
  await page.locator('#demoBtn').click()
  await page.wait_for_timeout(200)
  print('after demo',await page.locator('#analysisBadge').inner_text(),'frames',await page.evaluate('FieldworkApp.state.session?.frames.length'))
  await page.wait_for_timeout(2000)
  print('after 2sec',await page.locator('#analysisBadge').inner_text(),'status',await page.evaluate('FieldworkApp.state.session?.frames.map(f=>f.analysis?.status)'),'times',await page.evaluate('FieldworkApp.state.session?.frames.map(f=>f.analysis?.processingMs)'))
  await page.screenshot(path=str(ROOT/'analysis-desktop.png'),full_page=True)
  await page.locator('#analysisNextBtn').click()
  await page.wait_for_timeout(500)
  print('review',await page.locator('#reviewFrameCount').inner_text(), 'img',await page.locator('#topdownImage').get_attribute('src'))
  await page.screenshot(path=str(ROOT/'review-desktop.png'),full_page=True)
  await page.locator('#reviewNextBtn').click()
  async with page.expect_download(timeout=15000) as dd:
   await page.locator('#exportZipBtn').click()
  d=await dd.value
  print('zip',d.suggested_filename)
  await d.save_as(str(ROOT/'test-session-export.zip'))
  await page.screenshot(path=str(ROOT/'export-desktop.png'),full_page=True)
  mobile=await browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,accept_downloads=True,device_scale_factor=1)
  page2=await mobile.new_page()
  page2.on('pageerror',lambda e:errors.append('mobile: '+str(e)))
  await page2.goto('about:blank')
  await page2.set_content((ROOT/'fieldwork-standalone.html').read_text(),wait_until='load')
  await page2.screenshot(path=str(ROOT/'home-mobile.png'),full_page=True)
  print('mobile overflow?',await page2.evaluate('document.documentElement.scrollWidth > innerWidth'), 'sizes',await page2.evaluate('[document.documentElement.scrollWidth,innerWidth]'))
  print('errors',errors)
  await browser.close()
asyncio.run(main())
