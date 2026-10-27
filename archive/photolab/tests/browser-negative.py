import asyncio
from pathlib import Path
from PIL import Image,ImageDraw
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
IMAGE=ROOT/'tests'/'felt_no_pockets.png'
im=Image.new('RGB',(900,540),(95,96,95));d=ImageDraw.Draw(im);d.polygon([(115,125),(775,92),(830,444),(70,477)],fill=(28,145,112));im.save(IMAGE)
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  context=await browser.new_context(viewport={'width':1070,'height':870},accept_downloads=True)
  page=await context.new_page()
  errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
  await page.goto('about:blank');await page.set_content((ROOT/'fieldwork-standalone.html').read_text(),wait_until='load')
  await page.locator('#newSessionBtn').click()
  await page.locator('#photosInput').set_input_files(str(IMAGE))
  await page.wait_for_timeout(200)
  print('uploaded frames',await page.evaluate('FieldworkApp.state.session.frames.length'))
  await page.locator('#captureNextBtn').click()
  await page.locator('#runAnalysisBtn').click()
  await page.wait_for_function('!FieldworkApp.state.busy && FieldworkApp.state.session.frames[0].analysis')
  print('no pocket status',await page.evaluate('FieldworkApp.state.session.frames[0].analysis.status'))
  print('observed',await page.evaluate('FieldworkApp.state.session.frames[0].analysis.metrics'))
  await page.locator('#analysisNextBtn').click()
  await page.wait_for_timeout(300)
  print('review',await page.locator('#reviewFrameCount').inner_text())
  await page.screenshot(path=str(ROOT/'review-negative-desktop.png'),full_page=True)
  # User manually nudges a corner. This must never be reported automatic.
  await page.locator('#editCornersBtn').click()
  canvas=page.locator('#reviewCanvas')
  bounds=await canvas.bounding_box();q=await page.evaluate('FieldworkApp.state.session.frames[0].analysis.table.corners')
  wd=await canvas.evaluate('(x)=>x.width');ht=await canvas.evaluate('(x)=>x.height')
  x=bounds['x']+q[0][0]/wd*bounds['width'];y=bounds['y']+q[0][1]/ht*bounds['height']
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+6,y+6,steps=3);await page.mouse.up()
  await page.wait_for_timeout(500)
  print('after manual',await page.evaluate('FieldworkApp.state.session.frames[0].analysis.method'))
  await page.locator('#resetCornersBtn').click()
  await page.wait_for_timeout(300)
  print('after reset',await page.evaluate('FieldworkApp.state.session.frames[0].analysis.method'))
  await page.locator('#reviewNextBtn').click()
  async with page.expect_download(timeout=15000) as download:
   await page.locator('#exportZipBtn').click()
  d=await download.value
  await d.save_as(str(ROOT/'test-no-pockets.zip'))
  await page.locator('#brandHome').click()
  await page.locator('#importInput').set_input_files(str(ROOT/'test-no-pockets.zip'))
  await page.wait_for_timeout(500)
  print('imported',await page.evaluate('FieldworkApp.state.session.frames.length'),'status',await page.evaluate('FieldworkApp.state.session.frames[0].analysis.status'))
  print('errors',errors)
  await browser.close()
asyncio.run(main())
