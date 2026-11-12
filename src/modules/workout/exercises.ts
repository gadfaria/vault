export const MUSCLE_GROUPS = {
  chest: 'Peito',
  back: 'Costas',
  shoulders: 'Ombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  legs: 'Pernas',
  glutes: 'Glúteos',
  core: 'Abdômen',
  cardio: 'Cardio',
} as const

export type MuscleGroup = keyof typeof MUSCLE_GROUPS

export interface Exercise {
  /** Stored in routines and sessions: never change it once the exercise is in use. */
  id: string
  name: string
  group: MuscleGroup
  /** How to do it, one step per line */
  description: string
  /** Timed exercises (plank…) log seconds where the others log repetitions */
  unit?: 'seconds'
  /** Image URLs shown in a loop (start and end of the movement), served by the app itself */
  frames?: string[]
}

/** The two photos in public/exercises/<id>/ (480px WebP), from the public-domain free-exercise-db dataset. */
function photos(id: string): string[] {
  return [`/exercises/${id}/0.webp`, `/exercises/${id}/1.webp`]
}

function exercise(
  id: string,
  name: string,
  group: MuscleGroup,
  steps: string[],
  options: { unit?: 'seconds' } = {},
): Exercise {
  return { id, name, group, description: steps.join('\n'), frames: photos(id), ...options }
}

/**
 * The exercise catalog is fixed in code. To add one, append an entry with a new id and put its
 * photos in public/exercises/<id>/; renaming is safe, changing or removing an id orphans the
 * history that points to it.
 */
export const EXERCISES: Exercise[] = [
  // Chest
  exercise('dumbbell-bench-press', 'Supino reto com halteres', 'chest', [
    'Deite no banco reto com um halter em cada mão na altura do peito e os pés firmes no chão.',
    'Junte as escápulas e empurre os halteres para cima até quase estender os braços.',
    'Desça controlando até os cotovelos passarem um pouco da linha do banco, a uns 45° do tronco.',
  ]),
  exercise('incline-dumbbell-press', 'Supino inclinado com halteres', 'chest', [
    'Ajuste o banco entre 30° e 45° e leve os halteres à altura da parte de cima do peito.',
    'Empurre para cima e levemente para dentro, sem bater os halteres.',
    'Desça devagar até sentir o peito alongar, mantendo os punhos alinhados com os cotovelos.',
  ]),
  exercise('machine-incline-press', 'Supino inclinado na máquina', 'chest', [
    'Ajuste o assento para as pegadas ficarem na linha da parte de cima do peito.',
    'Com as costas apoiadas e as escápulas juntas, empurre até quase estender os braços.',
    'Volte devagar até os cotovelos passarem um pouco da linha do tronco, sem soltar o peso.',
  ]),
  exercise('cable-crossover', 'Crossover', 'chest', [
    'Com as polias no alto, segure uma pegada em cada mão e dê um passo à frente.',
    'Incline o tronco levemente e mantenha os cotovelos um pouco flexionados.',
    'Feche os braços em arco até as mãos se encontrarem à frente do quadril.',
    'Abra controlando até sentir o peito alongar, sem deixar os ombros irem para a frente.',
  ]),
  exercise('bench-cable-fly', 'Crucifixo na polia', 'chest', [
    'Posicione o banco entre as polias baixas e deite com uma pegada em cada mão.',
    'Com os cotovelos levemente flexionados, feche os braços em arco até as mãos se encontrarem acima do peito.',
    'Abra devagar até os braços ficarem na linha do banco, mantendo a tensão no peito.',
  ]),

  // Back
  exercise('lat-pulldown', 'Puxada alta', 'back', [
    'Sente com as coxas presas no apoio e segure a barra com pegada aberta.',
    'Incline o tronco levemente para trás e mantenha o peito alto.',
    'Puxe a barra até a parte de cima do peito, levando os cotovelos para baixo e para trás.',
    'Volte devagar até estender os braços, sem soltar o peso.',
  ]),
  exercise('seated-cable-row', 'Remada baixa', 'back', [
    'Sente com os pés no apoio, joelhos levemente flexionados e a coluna reta.',
    'Puxe a pegada em direção ao abdômen, aproximando as escápulas.',
    'Volte controlando até estender os braços, sem arredondar as costas nem balançar o tronco.',
  ]),
  exercise('chest-supported-t-bar-row', 'Remada cavalinho', 'back', [
    'Apoie o peito no encosto da máquina e segure as pegadas com os braços estendidos.',
    'Puxe levando os cotovelos para trás e junte as escápulas no fim.',
    'Desça devagar até alongar as costas, sem tirar o peito do apoio.',
  ]),
  exercise('machine-high-row', 'Puxada articulada', 'back', [
    'Sente de frente para a máquina com o peito no apoio e segure a pegada acima da cabeça.',
    'Puxe para baixo levando o cotovelo em direção ao quadril.',
    'Volte devagar até estender o braço e sentir a lateral das costas alongar.',
  ]),
  exercise('machine-row', 'Remada articulada', 'back', [
    'Ajuste o assento para as pegadas ficarem na altura do peito e apoie o tronco no encosto.',
    'Puxe levando os cotovelos para trás, rente ao corpo, e junte as escápulas.',
    'Volte controlando até estender os braços, sem tirar o peito do apoio.',
  ]),

  // Shoulders
  exercise('dumbbell-shoulder-press', 'Desenvolvimento com halteres', 'shoulders', [
    'Sentado com as costas apoiadas, leve os halteres à altura dos ombros, palmas para a frente.',
    'Empurre para cima até quase estender os braços, sem bater os halteres.',
    'Desça controlando até os cotovelos ficarem um pouco abaixo da linha dos ombros.',
  ]),
  exercise('dumbbell-lateral-raise', 'Elevação lateral', 'shoulders', [
    'Em pé, segure um halter em cada mão ao lado do corpo, cotovelos levemente flexionados.',
    'Eleve os braços para os lados até a altura dos ombros, com os cotovelos guiando o movimento.',
    'Desça devagar, sem balançar o tronco nem encolher os ombros.',
  ]),
  exercise('cable-lateral-raise', 'Elevação lateral na polia', 'shoulders', [
    'Fique de lado para a polia e segure a pegada com a mão mais distante dela.',
    'Eleve o braço para o lado até a altura do ombro, com o cotovelo levemente flexionado.',
    'Volte devagar, mantendo a tensão do cabo até o fim.',
  ]),
  exercise('incline-front-raise', 'Elevação frontal', 'shoulders', [
    'Apoie as costas no banco inclinado, com um halter em cada mão e os braços estendidos ao lado do corpo.',
    'Eleve os braços à frente até a altura dos ombros, sem dobrar os cotovelos.',
    'Desça controlando, sem tirar as costas do banco.',
  ]),
  exercise('face-pull', 'Face pull', 'shoulders', [
    'Com a corda na polia alta, segure com as palmas para dentro e dê um passo para trás.',
    'Puxe a corda em direção ao rosto, abrindo as mãos e levando os cotovelos para cima e para trás.',
    'Segure um instante com as escápulas juntas e volte devagar.',
  ]),
  exercise('reverse-cable-fly', 'Crucifixo inverso', 'shoulders', [
    'De frente para as polias, cruze os cabos e segure cada um com a mão oposta.',
    'Abra os braços para trás em arco, com os cotovelos levemente flexionados, até a linha dos ombros.',
    'Volte devagar até as mãos se cruzarem à frente, sem encolher os ombros.',
  ]),

  // Biceps
  exercise('cable-curl', 'Rosca direta na polia', 'biceps', [
    'De frente para a polia baixa, segure a barra com as palmas para cima.',
    'Flexione os cotovelos levando a barra até perto dos ombros, sem afastar os cotovelos do tronco.',
    'Desça devagar até estender os braços, sem balançar o corpo.',
  ]),
  exercise('incline-dumbbell-curl', 'Rosca no banco inclinado', 'biceps', [
    'Sente no banco inclinado a uns 45° e deixe os braços pendurados com um halter em cada mão.',
    'Flexione os cotovelos sem trazê-los para a frente, girando as palmas para cima.',
    'Desça até estender os braços e sentir o bíceps alongar.',
  ]),
  exercise('machine-preacher-curl', 'Rosca Scott', 'biceps', [
    'Ajuste o assento para as axilas ficarem na borda do apoio e os braços inteiros apoiados.',
    'Flexione os cotovelos até a pegada chegar perto dos ombros.',
    'Desça devagar até quase estender os braços, sem tirar os cotovelos do apoio.',
  ]),

  // Triceps
  exercise('triceps-pushdown', 'Tríceps na polia', 'triceps', [
    'De frente para a polia alta, segure a barra com os cotovelos colados ao tronco.',
    'Estenda os braços para baixo até o fim, contraindo o tríceps.',
    'Volte até os antebraços passarem um pouco da linha horizontal, sem mover os cotovelos.',
  ]),
  exercise('rope-pushdown', 'Tríceps corda', 'triceps', [
    'Segure a corda na polia alta com as palmas para dentro e os cotovelos colados ao tronco.',
    'Estenda os braços para baixo e, no fim, afaste as pontas da corda para os lados.',
    'Volte devagar até os antebraços passarem da horizontal, sem mover os cotovelos.',
  ]),
  exercise('overhead-rope-triceps-extension', 'Tríceps francês', 'triceps', [
    'De costas para a polia, segure a corda atrás da cabeça com os cotovelos apontados para cima.',
    'Estenda os braços à frente e acima da cabeça, sem abrir os cotovelos.',
    'Volte devagar até as mãos passarem da nuca, sentindo o tríceps alongar.',
  ]),

  // Legs
  exercise('barbell-squat', 'Agachamento livre', 'legs', [
    'Apoie a barra no trapézio, pés na largura dos ombros e pontas levemente para fora.',
    'Desça levando o quadril para trás e para baixo, com os joelhos na direção dos pés.',
    'Vá até as coxas ficarem paralelas ao chão ou um pouco abaixo, mantendo a coluna neutra.',
    'Suba empurrando o chão, sem deixar os joelhos caírem para dentro.',
  ]),
  exercise('leg-press', 'Leg press 45°', 'legs', [
    'Sente com as costas e o quadril bem apoiados e os pés na largura dos ombros na plataforma.',
    'Destrave e desça flexionando os joelhos até perto de 90°, sem tirar o quadril do banco.',
    'Empurre a plataforma sem travar os joelhos no fim do movimento.',
  ]),
  exercise('bulgarian-split-squat', 'Agachamento búlgaro', 'legs', [
    'De costas para o banco, apoie o peito de um pé nele e segure um halter em cada mão.',
    'Desça flexionando o joelho da frente até a coxa ficar paralela ao chão.',
    'Suba empurrando com o calcanhar da frente, mantendo o tronco firme. Troque a perna ao terminar.',
  ]),
  exercise('leg-extension', 'Cadeira extensora', 'legs', [
    'Ajuste o encosto para os joelhos ficarem alinhados com o eixo da máquina e o rolo acima dos pés.',
    'Estenda os joelhos até as pernas ficarem retas e segure um instante.',
    'Desça devagar, sem deixar o peso bater.',
  ]),
  exercise('lying-leg-curl', 'Mesa flexora', 'legs', [
    'Deite de bruços com os joelhos logo depois da borda e o rolo acima dos calcanhares.',
    'Flexione os joelhos levando o rolo em direção aos glúteos, sem tirar o quadril do apoio.',
    'Desça controlando até quase estender as pernas.',
  ]),
  exercise('standing-leg-curl', 'Flexora em pé', 'legs', [
    'Em pé na máquina, apoie o tronco e posicione o rolo acima do calcanhar de uma perna.',
    'Flexione o joelho levando o calcanhar em direção ao glúteo, sem mover o quadril.',
    'Desça devagar até estender a perna. Troque de lado ao terminar.',
  ]),
  exercise('stiff-leg-deadlift', 'Stiff', 'legs', [
    'Em pé, segure a barra à frente das coxas com os joelhos levemente flexionados.',
    'Leve o quadril para trás e desça a barra rente às pernas, com a coluna reta.',
    'Vá até sentir a parte de trás das coxas alongar e suba contraindo glúteos e posteriores.',
  ]),
  exercise('deadlift', 'Levantamento terra', 'legs', [
    'Com a barra sobre o meio dos pés, agache e segure-a logo fora das pernas, coluna reta e peito alto.',
    'Empurre o chão e suba com a barra rente ao corpo, estendendo joelhos e quadril juntos.',
    'Termine em pé com o quadril estendido e desça pelo mesmo caminho, sem arredondar a lombar.',
  ]),
  exercise('hip-adduction', 'Cadeira adutora', 'legs', [
    'Sente com as costas apoiadas e as pernas abertas contra os apoios.',
    'Feche as pernas até os apoios se encontrarem e segure um instante.',
    'Abra devagar até sentir a parte interna das coxas alongar.',
  ]),
  exercise('hack-calf-raise', 'Panturrilha no hack', 'legs', [
    'De frente para o encosto do hack, apoie os ombros e fique com a ponta dos pés na borda da plataforma.',
    'Suba na ponta dos pés o mais alto que conseguir e segure um instante.',
    'Desça devagar até os calcanhares passarem da linha da plataforma.',
  ]),
  exercise('seated-calf-raise', 'Panturrilha sentado', 'legs', [
    'Sente com os joelhos sob o apoio e a ponta dos pés na plataforma.',
    'Eleve os calcanhares o mais alto que conseguir e segure um instante.',
    'Desça devagar até alongar bem a panturrilha.',
  ]),

  // Glutes
  exercise('hip-thrust', 'Elevação pélvica', 'glutes', [
    'Apoie a parte de cima das costas no encosto, com os pés firmes e os joelhos flexionados.',
    'Eleve o quadril até o tronco ficar alinhado com as coxas, contraindo os glúteos no topo.',
    'Desça controlando, sem deixar o quadril encostar por completo.',
  ]),
  exercise('hip-abduction', 'Cadeira abdutora', 'glutes', [
    'Sente com as costas apoiadas e a parte de fora das coxas contra os apoios.',
    'Abra as pernas o máximo que conseguir e segure um instante.',
    'Volte devagar, sem deixar o peso bater.',
  ]),

  // Core
  exercise('decline-reverse-crunch', 'Abdominal infra', 'core', [
    'Deite no banco declinado com a cabeça no alto e segure o apoio atrás dela.',
    'Com os joelhos flexionados, eleve o quadril levando os joelhos em direção ao peito.',
    'Desça devagar, sem deixar as pernas caírem nem arquear a lombar.',
  ]),
  exercise('cable-crunch', 'Abdominal na polia', 'core', [
    'Segure a corda da polia alta ao lado da cabeça.',
    'Flexione o tronco levando os cotovelos em direção às coxas, enrolando a coluna.',
    'Volte devagar, sem puxar com os braços nem mover o quadril.',
  ]),
  exercise(
    'plank',
    'Prancha',
    'core',
    [
      'Apoie os antebraços no chão, com os cotovelos sob os ombros, e estenda as pernas.',
      'Mantenha o corpo em linha reta da cabeça aos calcanhares, com abdômen e glúteos contraídos.',
      'Segure pelo tempo da série, respirando normalmente e sem deixar o quadril cair.',
    ],
    { unit: 'seconds' },
  ),
]

const BY_ID = new Map(EXERCISES.map((exercise) => [exercise.id, exercise]))

export function findExercise(id: string): Exercise | undefined {
  return BY_ID.get(id)
}

/** Name for display; history may point to an id that left the catalog. */
export function exerciseName(id: string): string {
  return BY_ID.get(id)?.name ?? 'Exercício removido'
}
