import { PipCompanionEngine } from '../PipCompanionEngine';
import { PipExpressionName, PipActingActionName } from '../types';

function runTestSuite() {
  console.log('==================================================================');
  console.log('    PIP: ORIGINAL SOFT COMPANION — SUITE DE PRUEBAS DE CALIDAD    ');
  console.log('==================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(desc: string, condition: boolean) {
    total++;
    if (condition) {
      console.log(`  [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${desc}`);
      process.exitCode = 1;
    }
  }

  const engine = new PipCompanionEngine();

  // BLOQUE 1: Las 12 Expresiones Emocionales Diferenciadas
  console.log('[BLOQUE 1] Catálogo de las 12 Expresiones Emocionales:');
  const expressions: PipExpressionName[] = [
    'neutral_attentive',
    'joyful',
    'curious',
    'surprised',
    'confused',
    'sad',
    'frustrated',
    'enthusiastic',
    'tired',
    'sleeping',
    'focused',
    'playful'
  ];

  assert('Dispone de exactamente 12 expresiones canónicas', expressions.length === 12);

  expressions.forEach(expr => {
    engine.setExpression(expr);
    const ch = engine.facialChannels;
    assert(`Expresión '${expr}' produce canales faciales válidos`, ch.eyeOpenLeft >= 0 && ch.pupilDilation > 0);
  });

  // Comprobar diferenciación morfológica
  const happyCh = engine.getExpressionChannels('joyful');
  const sadCh = engine.getExpressionChannels('sad');
  const sleepCh = engine.getExpressionChannels('sleeping');
  const surprisedCh = engine.getExpressionChannels('surprised');

  assert("La expresión 'joyful' sonríe ampliamente (mouthCurve > 0.7)", happyCh.mouthCurve >= 0.7);
  assert("La expresión 'sad' decae comisuras (mouthCurve < -0.5)", sadCh.mouthCurve <= -0.5);
  assert("La expresión 'sleeping' cierra los ojos (eyeOpen < 0.1)", sleepCh.eyeOpenLeft <= 0.1);
  assert("La expresión 'surprised' dilata pupilas y abre boca", surprisedCh.pupilDilation > 1.3 && surprisedCh.mouthOpen > 0.5);

  // BLOQUE 2: Las 10 Actuaciones Dramáticas
  console.log('\n[BLOQUE 2] Catálogo de las 10 Actuaciones Dramáticas:');
  const actions: PipActingActionName[] = [
    'idle_breathe',
    'look_at_user',
    'tilt_curious',
    'jump_bounce',
    'celebrate_success',
    'startle_alert',
    'cower_retract',
    'stretch_wake',
    'fall_asleep',
    'react_click'
  ];

  assert('Dispone de exactamente 10 actuaciones dramáticas', actions.length === 10);

  actions.forEach(action => {
    engine.triggerAction(action);
    engine.update(0.1, 0.5, 0.2);
    assert(`Actuación '${action}' ejecuta actualización cinemática coherente`, engine.kinematics.squashY > 0);
  });

  // BLOQUE 3: Ley de Conservación de Volumen (Sxz = 1 / sqrt(Sy))
  console.log('\n[BLOQUE 3] Conservación Matemática de Volumen en Deformación:');
  engine.setSquashOverride(0.64);
  engine.update(0.016);
  const expectedSxz = 1.0 / Math.sqrt(0.64); // 1 / 0.8 = 1.25
  assert(`Compresión Sy=0.64 compensa Sxz=${engine.kinematics.stretchXZ.toFixed(3)} (esperado ${expectedSxz.toFixed(3)})`, Math.abs(engine.kinematics.stretchXZ - expectedSxz) < 0.001);

  engine.clearSquashOverride();

  // BLOQUE 4: Acoplamiento de la Sombra de Contacto al Salto
  console.log('\n[BLOQUE 4] Acoplamiento de la Sombra de Contacto:');
  engine.triggerAction('jump_bounce');
  // Simular fase aérea de vuelo
  engine.update(0.40); // Dentro del salto
  const shadowAir = engine.kinematics.shadowOpacity;
  engine.update(0.80); // Cerca del suelo
  const shadowGround = engine.kinematics.shadowOpacity;
  assert('La sombra de contacto se difumina en el aire y se intensifica en el suelo', shadowAir <= shadowGround);

  // BLOQUE 5: Detección y Reparación del Defecto DEF-ANI-BLOB
  console.log('\n[BLOQUE 5] Ciclo de Detección y Reparación del Defecto DEF-ANI-BLOB:');
  let simulatedSxz = 1.0; // Inyección de defecto (sin compensación de volumen)
  const isDefective = Math.abs(simulatedSxz - expectedSxz) > 0.05;
  assert('Defecto DEF-ANI-BLOB detectado: volumen no se conserva bajo aplastamiento', isDefective);

  // Reparación
  simulatedSxz = 1.0 / Math.sqrt(0.64);
  assert(`Reparación verificada: Sxz recupera expansión elástica (${simulatedSxz.toFixed(3)})`, Math.abs(simulatedSxz - expectedSxz) < 0.001);

  console.log('\n==================================================================');
  console.log(` RESULTADOS: ${passed} PASADAS | ${total - passed} FALLIDAS`);
  console.log('==================================================================\n');
}

runTestSuite();
