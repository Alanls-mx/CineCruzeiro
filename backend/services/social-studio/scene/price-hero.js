const {wrapText}=require('./factory');

function PriceHero({value,x,y,width,height,fill,variant='giant'}) {
  if(!Number.isFinite(value) || value<0) return [];
  const amount=value.toLocaleString('pt-BR',{minimumFractionDigits:Number.isInteger(value)?0:2,maximumFractionDigits:2});
  const currencyWidth=Math.min(85,width*.14), gap=width*.018;
  const preferred=Math.min(320,height*.98);
  const fitted=wrapText(amount,width-currencyWidth-gap,height,preferred,1);
  const text=(id,text,x,y,width,height,fontSize)=>({id,name:id,role:id,type:'text',x,y,width,height,text,fontSize,fontFamily:'Social Display',fontWeight:900,lineHeight:1.05,fill,hierarchy:'primary',required:true});
  const size=Math.min(fitted.fontSize,preferred);
  return [
    text('currency','R$',x,y+height*.42,currencyWidth,height*.37,Math.min(62,size*.4)),
    {...text('detail',amount,x+currencyWidth+gap,y,width-currencyWidth-gap,height,size),name:`Preço ${variant}`}
  ];
}

module.exports={PriceHero};
