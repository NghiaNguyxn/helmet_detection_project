import React from 'react';

const Skeleton = ({ className, width, height, rounded = 'rounded-md' }) => {
  return (
    <div 
      className={`skeleton ${rounded} ${className}`}
      style={{ 
        width: width || '100%', 
        height: height || '20px'
      }}
    />
  );
};

export default Skeleton;
