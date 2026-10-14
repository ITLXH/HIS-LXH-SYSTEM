// Produce fixed PDF pages rather than relying on printer HTML fragmentation.
export async function createRequestFormPdf(doc) {
  await doc.fonts.ready;
  const pages = [];
  for (const sheet of doc.querySelectorAll('.it-sheet')) {
    const image = sheet.querySelector('.it-background');
    await image.decode();
    const canvas = doc.createElement('canvas');
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const bounds = sheet.getBoundingClientRect(), scale = canvas.width / bounds.width;
    for (const element of sheet.querySelectorAll('.it-row[style*="background:white"], .it-replacement, .it-check, .it-field')) {
      const rect = element.getBoundingClientRect(), style = doc.defaultView.getComputedStyle(element);
      const x = (rect.left-bounds.left)*scale, y = (rect.top-bounds.top)*scale;
      if (!element.classList.contains('it-check')) {
        ctx.fillStyle='#fff';ctx.fillRect(x,y,rect.width*scale,rect.height*scale);
      }
      if (element.textContent.trim()) {
        ctx.fillStyle='#111';ctx.textBaseline='top';
        ctx.font=`${style.fontWeight} ${parseFloat(style.fontSize)*scale}px ${style.fontFamily}`;
        ctx.fillText(element.textContent.trim(),x+parseFloat(style.paddingLeft || 0)*scale,y,rect.width*scale);
      }
    }
    pages.push({width:canvas.width,height:canvas.height,jpeg:canvas.toDataURL('image/jpeg',.98)});
  }
  // Preserve additional orders/notes on explicitly generated appendix pages.
  const appendix = doc.querySelector('.it-appendix');
  if (appendix) {
    let canvas,ctx,y;
    const start = () => {canvas=doc.createElement('canvas');canvas.width=1488;canvas.height=2105;ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1488,2105);ctx.fillStyle='#111';ctx.font='28px "Phetsarath OT", "Noto Sans Lao", Arial';ctx.textBaseline='top';y=80;};
    const finish = () => pages.push({width:canvas.width,height:canvas.height,jpeg:canvas.toDataURL('image/jpeg',.98)});
    start();
    for(const paragraph of appendix.children){
      let line='';
      for(const word of paragraph.textContent.split(/\s+/)){
        if(ctx.measureText(line+' '+word).width>1320 && line){if(y>1980){finish();start();}ctx.fillText(line,80,y);y+=40;line=word;}else line+=(line?' ':'')+word;
      }
      if(y>1980){finish();start();}ctx.fillText(line,80,y);y+=55;
    }
    finish();
  }
  const encode = value => new TextEncoder().encode(value);
  const objects = [null,encode('<< /Type /Catalog /Pages 2 0 R >>'),null];
  const kids=[];
  for(const page of pages){
    const id=objects.length,imageId=id+1,contentId=id+2;kids.push(`${id} 0 R`);
    objects.push(encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.276 841.89] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`));
    const raw=atob(page.jpeg.split(',')[1]),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
    const header=encode(`<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`),tail=encode('\nendstream');
    const imageObject=new Uint8Array(header.length+bytes.length+tail.length);imageObject.set(header);imageObject.set(bytes,header.length);imageObject.set(tail,header.length+bytes.length);objects.push(imageObject);
    const content='q\n595.276 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n';objects.push(encode(`<< /Length ${encode(content).length} >>\nstream\n${content}endstream`));
  }
  objects[2]=encode(`<< /Type /Pages /Count ${pages.length} /Kids [${kids.join(' ')}] >>`);
  const chunks=[encode('%PDF-1.4\n')],offsets=[0];let size=chunks[0].length;
  for(let id=1;id<objects.length;id++){offsets.push(size);const first=encode(`${id} 0 obj\n`),last=encode('\nendobj\n');chunks.push(first,objects[id],last);size+=first.length+objects[id].length+last.length;}
  const xref=size;chunks.push(encode(`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`));
  return new Blob(chunks,{type:'application/pdf'});
}
