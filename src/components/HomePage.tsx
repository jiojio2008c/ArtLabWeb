import React from 'react'

interface HomePageProps {
  onSelectScene: (sceneName: string) => void
}

const HomePage: React.FC<HomePageProps> = ({ onSelectScene }) => {
  const scenes = [
    { name: 'fish', label: '海底珊瑚', image: '/fish.png' },
    { name: 'people', label: '動物小鎮', image: '/people.png' },
    { name: 'other', label: '空白網格', image: '' }
  ]

  return (
    <div className="min-h-screen home-background apple-container">
      {/* Header */}
      <div className="container mx-auto px-6 py-20 max-w-5xl">
        <h1 className="text-5xl font-bold text-gray-900 text-center mb-4 apple-title">Art Lab</h1>
        <p className="text-xl text-gray-600 text-center mb-20 apple-subtitle">選擇您的場景</p>

        {/* Scene Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {scenes.map((scene) => (
            <div
              key={scene.name}
              className="group cursor-pointer apple-card rounded-xl overflow-hidden transition-all duration-300"
              onClick={() => onSelectScene(scene.name)}
            >
              {/* Scene Preview */}
              <div className="h-72 bg-gray-100 flex items-center justify-center overflow-hidden">
                {scene.image ? (
                  <img
                    src={scene.image}
                    alt={scene.label}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="text-gray-500">
                    <svg className="w-24 h-24 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12l4 4m0 0l-4 4m4-4H8m4-4v8" />
                    </svg>
                    <div className="text-xl">空白网格</div>
                  </div>
                )}
              </div>

              {/* Scene Label */}
              <div className="p-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">{scene.label}</h2>
                <p className="text-gray-500">點擊選擇此場景</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-32 text-center text-gray-500 text-sm">
          <p>Art Lab Web • 2026</p>
        </div>
      </div>
    </div>
  )
}

export default HomePage