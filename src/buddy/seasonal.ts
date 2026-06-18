export type SeasonalEvent = {
  id: string
  name: string
  messages: string[]
  emoji: string
  month: number // 0-indexed
  day?: number | null
  outfit?: string
}

// Calcula a data do Carnaval (47 dias antes da Páscoa)
function getCarnavalDate(year: number): { month: number; day: number } {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1
  const day = ((h + l - 7 * m + 114) % 31) + 1
  const pascoa = new Date(year, month, day)
  pascoa.setDate(pascoa.getDate() - 47)
  return { month: pascoa.getMonth(), day: pascoa.getDate() }
}

function pickMessage(messages: string[]): string {
  return messages[Math.floor(Date.now() / 1000) % messages.length]!
}

const now = new Date()
const nextYear = now.getFullYear() + 1

export const SEASONAL_EVENTS: SeasonalEvent[] = [
  {
    id: 'natal',
    name: 'Natal',
    messages: [
      'Feliz Natal! Lembre que o real motivo desse dia é Jesus. Que a paz dele encha seu coração e seu código!',
      'Natal é tempo de amor e código! Que seu deploy de hoje seja abençoado!',
      'Merry Christmas! Que as luzes da árvore iluminem seus commits!',
      'Feliz Natal! O melhor presente é um código que funciona na primeira!',
      'Natal chegou! Até o buddy tá de gorro vermelho hoje!',
    ],
    emoji: '🎄',
    month: 11,
    day: 25,
    outfit: 'festivo',
  },
  {
    id: 'reveillon',
    name: 'Réveillon',
    messages: [
      `Feliz ${nextYear}! Que o novo ano seja cheio de commits sem bugs e deploys tranquilos!`,
      `${nextYear} chegou! Hora de fazer novas resoluções: mais código, menos bugs!`,
      `Ano novo, código novo! Que ${nextYear} seja épico!`,
      `Feliz ${nextYear}! Que seu streak continue forte no novo ano!`,
      `${nextYear}! Vamos começar o ano com o pé direito no terminal!`,
    ],
    emoji: '🎆',
    month: 11,
    day: 31,
    outfit: 'festivo',
  },
  {
    id: 'carnaval',
    name: 'Carnaval',
    messages: [
      'É Carnaval! Mexe que eu tô usando meu outfit mais colorido!',
      'Carnaval é alegria! Bora dançar entre um commit e outro!',
      'Chegou Carnaval! Hora de mascarar os bugs e curtir a festa!',
      'Olha o bloco passando! Até o buddy tá de fantasia!',
      'Carnaval: quando até os erros ficam coloridos!',
    ],
    emoji: '🎭',
    month: getCarnavalDate(now.getFullYear()).month,
    day: getCarnavalDate(now.getFullYear()).day,
  },
  {
    id: 'halloween',
    name: 'Halloween',
    messages: [
      'Boo! Os bugs estão soltos esta noite... Cuidado com os ghosts no código!',
      'Happy Halloween! Que seus testes assustem todos os bugs!',
      'Halloween: a noite em que até o código fica assustador!',
      'Trick or treat? Eu prefiro test!',
      '🎃 Os zombies do código estão soltos! Hora de debugar!',
    ],
    emoji: '🎃',
    month: 9,
    day: 31,
  },
  {
    id: 'dia-programador',
    name: 'Dia do Programador',
    messages: [
      'Feliz dia do programador! 256 dias de pura dedicação. Você é incrível!',
      'Dia do programador! Que seu código seja tão limpo quanto sua consciência!',
      'Hoje é o dia dos heróis do teclado! Feliz dia do programador!',
      '256 dias de código! Você faz a internet funcionar. Parabéns!',
      'Dia do programador: o único dia em que stack overflow é motivo de orgulho!',
    ],
    emoji: '💻',
    month: 8,
    day: 13,
  },
  {
    id: 'dia-namorados',
    name: 'Dia dos Namorados',
    messages: [
      'Feliz dia dos namorados! O único compromisso que eu tenho é com seu código!',
      'Dia dos namorados! Meu amor é por código limpo e testes passando!',
      'Love is in the air... e no pull request!',
      'Feliz dia dos namorados! Seu buddy te ama mais que um merge sem conflito!',
      'Dia dos namorados: quando até o git blame fica romântico!',
    ],
    emoji: '💕',
    month: 5,
    day: 12,
  },
  {
    id: 'pascoa',
    name: 'Páscoa',
    messages: [
      'Feliz Páscoa! Que sua caça aos bugs seja tão boa quanto caça aos ovos!',
      'Páscoa! Ovos de chocolate e commits doces!',
      'Feliz Páscoa! Que a ressurreição do código morto traga vida nova!',
      'Páscoa: quando até os coelhos fazem deploy!',
      'Feliz Páscoa! Que seu código renasça sem bugs!',
    ],
    emoji: '🐰',
    month: getCarnavalDate(now.getFullYear()).month,
    day: getCarnavalDate(now.getFullYear()).day + 47,
  },
]

export function getActiveSeasonalEvent(): SeasonalEvent | null {
  const now = new Date()
  const month = now.getMonth()
  const day = now.getDate()

  for (const event of SEASONAL_EVENTS) {
    if (event.month === month) {
      if (event.day === null || event.day === undefined || event.day === day) {
        return event
      }
    }
  }
  return null
}

export function getSeasonalMessage(): string | null {
  const event = getActiveSeasonalEvent()
  if (!event) return null
  return `${event.emoji} ${pickMessage(event.messages)}`
}
