import clsx from 'clsx'

const POSITION_COLORS = {
  GK:  'bg-yellow-500/20 text-yellow-300',
  DEF: 'bg-blue-500/20 text-blue-300',
  MID: 'bg-green-500/20 text-green-300',
  FWD: 'bg-red-500/20 text-red-300',
}

export default function PlayerCard({ player, selected, onToggle, disabled }) {
  const isSelected = selected
  const canSelect  = !disabled || isSelected

  return (
    <div
      onClick={() => canSelect && onToggle(player)}
      className={clsx(
        'relative border rounded-xl p-3 cursor-pointer transition-all',
        isSelected
          ? 'border-fifa-gold bg-fifa-gold/10 shadow-lg shadow-fifa-gold/20'
          : 'border-white/10 bg-white/5 hover:border-white/30',
        !canSelect && 'opacity-40 cursor-not-allowed',
      )}
    >
      {/* Position badge */}
      <span className={clsx('badge', POSITION_COLORS[player.position])}>
        {player.position}
      </span>

      {/* Selected tick */}
      {isSelected && (
        <span className="absolute top-2 right-2 text-fifa-gold text-lg">✓</span>
      )}

      <div className="mt-2">
        <p className="font-bold text-sm leading-tight">{player.name}</p>
        <p className="text-gray-400 text-xs mt-0.5">{player.country} · {player.club}</p>
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">Rating</span>
          <span className={clsx(
            'text-sm font-bold',
            player.rating >= 90 ? 'text-fifa-gold' :
            player.rating >= 85 ? 'text-green-400' : 'text-gray-300'
          )}>
            {player.rating}
          </span>
        </div>
        <span className="text-sm font-bold text-fifa-gold">${(player.price / 1000000).toFixed(0)}M</span>
      </div>
    </div>
  )
}
