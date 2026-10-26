// Relative luminance of the currently visible crop; choose light or dark ink.
export function chooseCardInk(pixels){
 let total=0,n=0;
 for(let i=0;i<pixels.length;i+=4){const l=[pixels[i],pixels[i+1],pixels[i+2]].map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});total+=.2126*l[0]+.7152*l[1]+.0722*l[2];n++;}
 return total/Math.max(1,n)>.179?'#172c25':'#ffffff';
}
