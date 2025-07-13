import React from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  hover = false,
  onClick 
}) => {
  const baseClasses = `
  relative 
  bg-blue/10 
  backdrop-blur-lg 
  border border-white/20 
  rounded-2xl 
  p-6 
  shadow-[inset_0_1px_0_#ffffff20,_0_4px_30px_rgba(0,0,0,0.1)] 
  before:absolute before:inset-0 before:bg-gradient-to-br 
  before:from-white/10 before:to-transparent 
  before:z-[-1] 
  overflow-hidden
`;
  const hoverClasses = hover ? 'cursor-pointer hover:border-blue-500/50 transition-all duration-300' : '';

  return (
    <motion.div
      whileHover={hover ? { scale: 1.02, y: -2 } : {}}
      whileTap={hover ? { scale: 0.98 } : {}}
      onClick={onClick}
      className={`${baseClasses} ${hoverClasses} ${className}`}
    >
      {children}
    </motion.div>
  );
};