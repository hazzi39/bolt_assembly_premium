import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

const ThemeToggle: React.FC = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`
        relative inline-flex h-9 w-16 items-center rounded-full
        transition-colors duration-300 ease-in-out focus:outline-none
        focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
        ${isDark ? 'bg-blue-600' : 'bg-gray-200'}
      `}
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle dark mode"
    >
      <span
        className={`
          ${isDark ? 'translate-x-[1.75rem]' : 'translate-x-1'}
          pointer-events-none inline-block h-7 w-7 transform rounded-full
          bg-white shadow-lg ring-0 transition duration-300 ease-in-out
          flex items-center justify-center
        `}
      >
        {isDark ? (
          <Moon className="h-4 w-4 text-blue-600" />
        ) : (
          <Sun className="h-4 w-4 text-yellow-500" />
        )}
      </span>
      <span className="sr-only">
        {isDark ? 'Disable dark mode' : 'Enable dark mode'}
      </span>
    </button>
  );
};

export default ThemeToggle;