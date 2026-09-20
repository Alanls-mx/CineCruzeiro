import React, { useState, useMemo } from 'react';
import { Search, X, Smile, User, Dog, Popcorn, Trophy, Car, Lightbulb, Heart } from 'lucide-react';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

interface EmojiCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    name: 'Sorrisos & Emoções',
    icon: <Smile size={18} />,
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
      '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨',
      '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕',
      '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '😟',
      '🙁', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣',
      '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻',
      '👽', '👾', '🤖'
    ],
  },
  {
    id: 'people',
    name: 'Pessoas & Gestos',
    icon: <User size={18} />,
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉',
      '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏',
      '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴',
      '👀', '👁️', '👅', '👄', '🫦', '🫂', '👶', '🧒', '👦', '👧', '🧑', '👨', '🧔', '👩', '🧓', '👴', '👵'
    ],
  },
  {
    id: 'animals',
    name: 'Animais & Natureza',
    icon: <Dog size={18} />,
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵',
      '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋',
      '🐌', '🐞', '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🐙', '🦑', '🦐',
      '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🦈', '🐊', '🐅', '🐆', '🦓', '🐘', '🦛', '🦏', '🐪',
      '🦒', '🦘', '🐎', '🐖', '🐑', '🐐', '🦌', '🐕', '🐩', '🐈', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩',
      '🕊️', '🐇', '🐾', '🌵', '🎄', '🌲', '🌳', '🌴', '🌱', '🌿', '☘️', '🍀', '🍃', '🍂', '🍁', '🍄',
      '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🌞', '🌝', '🌛', '🌜', '🌚', '🌕', '🌖', '🌗',
      '🌘', '🌑', '🌒', '🌓', '🌔', '🌙', '🌎', '🌍', '🌏', '🪐', '💫', '⭐️', '🌟', '✨', '⚡️', '🔥',
      '🌈', '☀️', '🌤️', '⛅️', '☁️', '🌧️', '⛈️', '🌩️', '❄️', '☃️', '💨', '💧', '💦', '🫧', '🌊'
    ],
  },
  {
    id: 'food',
    name: 'Comida & Bebida (Cinema)',
    icon: <Popcorn size={18} />,
    emojis: [
      '🍿', '🎟️', '🎬', '🥤', '🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🫔', '🥗', '🍝', '🍜', '🍲',
      '🍛', '🍣', '🍱', '🥟', '🍤', '🍙', '🍚', '🍨', '🍧', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭',
      '🍬', '🍫', '🍩', '🍪', '🌰', '🥜', '🍯', '🥛', '🍼', '☕️', '🫖', '🍵', '🧃', '🧋', '🍺', '🍻',
      '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊', '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇',
      '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🌽', '🥕', '🥖', '🥨', '🧀'
    ],
  },
  {
    id: 'activities',
    name: 'Atividades & Esportes',
    icon: <Trophy size={18} />,
    emojis: [
      '⚽️', '🏀', '🏈', '⚾️', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🏓', '🏸', '🏒', '🥊', '🥋', '🛹',
      '🛼', '⛸️', '🎿', '🏂', '🏋️', '🤸', '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🎫', '🎟️', '🎪',
      '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🎻', '🎲', '♟️', '🎯', '🎳',
      '🎮', '🎰', '🧩'
    ],
  },
  {
    id: 'travel',
    name: 'Viagens & Lugares',
    icon: <Car size={18} />,
    emojis: [
      '🚗', '🚕', '🚙', '🚌', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🛵', '🏍️', '🚲',
      '🛴', '🚨', '✈️', '🛫', '🛬', '🚀', '🛸', '🚁', '⛵️', '🚤', '🛳️', '⛴️', '🚢', '⚓️', '⛽️', '🚧',
      '🚦', '🚥', '🗺️', '🗿', '🗽', '🗼', '🏰', '🏟️', '🎡', '🎢', '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️',
      '🏕️', '⛺️', '🏠', '🏡', '🏢', '🏥', '🏦', '🏨', '🏪', '🏫', '🏬', '🏭'
    ],
  },
  {
    id: 'objects',
    name: 'Objetos & Tecnologia',
    icon: <Lightbulb size={18} />,
    emojis: [
      '💡', '🔦', '🕯️', '📱', '📲', '☎️', '📞', '🔋', '🔌', '💻', '🖥️', '🖨️', '⌨️', '🖱️', '🎥', '🎞️',
      '📽️', '📺', '📷', '📸', '📹', '🔍', '🔎', '⏰', '⏱️', '💳', '💵', '💰', '🪙', '✉️', '📩', '📦',
      '🏷️', '📄', '📑', '📊', '📈', '📅', '📆', '📋', '📁', '📂', '📌', '📍', '📎', '✂️', '🖊️', '📝',
      '✏️', '🔒', '🔓', '🔑', '🗝️', '🔨', '🔧', '🪛', '⚙️', '🛡️', '🎁', '🎈', '🎉', '🎊'
    ],
  },
  {
    id: 'symbols',
    name: 'Símbolos & Corações',
    icon: <Heart size={18} />,
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
      '💘', '💝', '💟', '☮️', '✝️', '☯️', '♈️', '♉️', '♊️', '♋️', '♌️', '♍️', '♎️', '♏️', '♐️', '♑️',
      '♒️', '♓️', '⚠️', '⛔️', '🚫', '💯', '💢', '♨️', '❗️', '❕', '❓', '❔', '‼️', '⁉️', '✅', '✔️',
      '❌', '⭕️', '🛑', '❇️', '✳️', '🌐', '🌀', '💤', '🆗', '🆙', '🆒', '🆕', '🆓', '🔟', '🔢', '#️⃣',
      '*️⃣', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'
    ],
  },
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect, onClose }) => {
  const [activeCategory, setActiveCategory] = useState<string>('smileys');
  const [search, setSearch] = useState<string>('');

  const filteredEmojis = useMemo(() => {
    if (!search.trim()) return null;
    const query = search.toLowerCase().trim();
    const all = EMOJI_CATEGORIES.flatMap((c) => c.emojis);
    return Array.from(new Set(all.filter((e) => e.includes(query))));
  }, [search]);

  const currentCategoryEmojis = useMemo(() => {
    const cat = EMOJI_CATEGORIES.find((c) => c.id === activeCategory);
    return cat ? cat.emojis : [];
  }, [activeCategory]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '80px',
        left: '24px',
        width: '360px',
        height: '420px',
        background: '#182032',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '16px',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(37, 211, 102, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        overflow: 'hidden',
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* Header with Search */}
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(17, 22, 34, 0.85)',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.06)',
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <Search size={16} color="#94a3b8" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar símbolos"
            autoFocus
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#fff',
              fontSize: '0.85rem',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Fechar"
        >
          <X size={18} />
        </button>
      </div>

      {/* Category Navigation Bar (when not searching) */}
      {!search && (
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(17, 22, 34, 0.5)',
            padding: '4px 8px',
            overflowX: 'auto',
            gap: '4px',
          }}
        >
          {EMOJI_CATEGORIES.map((cat) => {
            const isActive = cat.id === activeCategory;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                title={cat.name}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 0',
                  background: isActive ? 'rgba(37, 211, 102, 0.15)' : 'transparent',
                  color: isActive ? '#25D366' : '#94a3b8',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  borderBottom: isActive ? '2px solid #25D366' : '2px solid transparent',
                }}
              >
                {cat.icon}
              </button>
            );
          })}
        </div>
      )}

      {/* Category Title / Search Status */}
      <div
        style={{
          padding: '8px 16px',
          fontSize: '0.75rem',
          fontWeight: 700,
          color: '#94a3b8',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          background: 'rgba(10, 13, 20, 0.4)',
        }}
      >
        {search ? `Resultados da busca` : EMOJI_CATEGORIES.find((c) => c.id === activeCategory)?.name}
      </div>

      {/* Emojis Grid */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px 14px',
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gap: '6px',
          alignContent: 'start',
        }}
      >
        {(search ? filteredEmojis || [] : currentCategoryEmojis).map((emoji, idx) => (
          <button
            key={`${emoji}-${idx}`}
            onClick={() => onSelect(emoji)}
            style={{
              fontSize: '1.4rem',
              background: 'transparent',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '36px',
              transition: 'transform 0.1s ease, background 0.1s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.transform = 'scale(1.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};
