export const LEVELS = [
  {name:'Exploradores',skill:'Encuentra las barras más altas y bajas',icon:'🔎'},
  {name:'Lectores expertos',skill:'Lee cantidades y valores',icon:'📊'},
  {name:'Comparadores',skill:'Compara y calcula diferencias',icon:'⚖️'},
  {name:'Supercalculadores',skill:'Suma barras y resuelve problemas',icon:'🧠'},
  {name:'Campeones JCH',skill:'Interpreta diagramas con varios pasos',icon:'🏆'}
];
const themes = [
  {title:'Frutas favoritas',unit:'votos',items:['Manzanas 🍎','Plátanos 🍌','Uvas 🍇','Fresas 🍓','Peras 🍐','Naranjas 🍊']},
  {title:'Mascotas preferidas',unit:'votos',items:['Perros 🐶','Gatos 🐱','Peces 🐟','Conejos 🐰','Tortugas 🐢','Aves 🐦']},
  {title:'Libros leídos',unit:'libros',items:['Ana','Luis','Sofía','Diego','Marta','José']},
  {title:'Flores del jardín',unit:'flores',items:['Rosas 🌹','Tulipanes 🌷','Margaritas 🌼','Girasoles 🌻','Claveles','Lirios']},
  {title:'Deportes favoritos',unit:'votos',items:['Fútbol ⚽','Tenis 🎾','Básquet 🏀','Natación 🏊','Vóley 🏐','Ciclismo 🚴']},
  {title:'Juguetes vendidos',unit:'juguetes',items:['Pelotas ⚽','Autos 🚗','Muñecas 🪆','Cometas 🪁','Trompos','Bloques 🧱']},
  {title:'Árboles plantados',unit:'árboles',items:['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']},
  {title:'Helados pedidos',unit:'helados',items:['Chocolate 🍫','Vainilla 🍦','Fresa 🍓','Mango 🥭','Limón 🍋','Coco 🥥']}
];
const random = (a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const pick=a=>a[random(0,a.length-1)];
const shuffled=a=>[...a].sort(()=>Math.random()-.5);
function uniqueValues(n,lo,hi){const set=new Set();while(set.size<n)set.add(random(lo,hi));return [...set]}
function selection(theme,n){return shuffled(theme.items).slice(0,n)}
export function buildQuestion(level){
  const theme=pick(themes), n=level===5?4:random(3,4);
  const items=selection(theme,n);
  const values=uniqueValues(n,1,level===1?10:level===2?15:level===3?18:level===4?20:24);
  const bars=items.map((label,i)=>({label,value:values[i]}));
  let prompt='',answer=0,explanation='';
  if(level===1){const most=Math.random()<.5;const idx=values.indexOf(most?Math.max(...values):Math.min(...values));answer=idx;prompt=`¿Qué categoría tiene la barra ${most?'más alta':'más baja'}?`;explanation=`${items[idx]} tiene ${values[idx]} ${theme.unit}, por eso su barra es la ${most?'más alta':'más baja'}.`}
  if(level===2){const idx=random(0,n-1);answer=values[idx];prompt=`¿Cuántos ${theme.unit} corresponden a ${items[idx]}?`;explanation=`La barra de ${items[idx]} alcanza el número ${answer}.`}
  if(level===3){const [i,j]=shuffled([...bars.keys()]).slice(0,2);answer=Math.abs(values[i]-values[j]);prompt=`¿Cuál es la diferencia entre ${items[i]} y ${items[j]}?`;explanation=`${Math.max(values[i],values[j])} − ${Math.min(values[i],values[j])} = ${answer}.`}
  if(level===4){const [i,j]=shuffled([...bars.keys()]).slice(0,2);answer=values[i]+values[j];prompt=`¿Cuántos ${theme.unit} hay entre ${items[i]} y ${items[j]}?`;explanation=`${values[i]} + ${values[j]} = ${answer}.`}
  if(level===5){const mode=random(0,2);const ix=shuffled([...bars.keys()]);if(mode===0){answer=values.reduce((a,b)=>a+b,0);prompt=`¿Cuántos ${theme.unit} hay en TOTAL en todas las categorías?`;explanation=`Sumamos: ${values.join(' + ')} = ${answer}.`;}else if(mode===1){answer=Math.max(...values)-Math.min(...values);prompt='¿Cuántos más hay en la categoría mayor que en la menor?';explanation=`${Math.max(...values)} − ${Math.min(...values)} = ${answer}.`;}else{const k=values.indexOf(Math.min(...values));const [i,j]=ix.filter(z=>z!==k).slice(0,2);answer=values[i]+values[j]-values[k];prompt=`Si juntamos ${items[i]} y ${items[j]} y quitamos ${items[k]}, ¿cuántos quedan?`;explanation=`${values[i]} + ${values[j]} − ${values[k]} = ${answer}.`;}}
  let options;
  if(level===1){options=items.map((label,i)=>({label,value:i}));}
  else{const distract=new Set([answer]);const deltas=[-5,-4,-3,-2,-1,1,2,3,4,5,6,7];while(distract.size<4){let x=answer+pick(deltas);if(x>=0)distract.add(x)}options=shuffled([...distract]).map(x=>({label:String(x),value:x}));}
  return {title:theme.title,unit:theme.unit,bars,prompt,options,answer,explanation};
}
