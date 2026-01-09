import React, { createContext, useContext, useState, useEffect } from 'react';
import { englishTranslations } from './en';
import { hebrewTranslations } from './he';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  // Initialize language from localStorage or default to English
  const [language, setLanguage] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('preferredLanguage') || 'English';
    }
    return 'English';
  });
  
  const translations = {
    English: englishTranslations,
    Hebrew: hebrewTranslations
  };

  const currentTranslations = translations[language];
  
  const toggleLanguage = () => {
    const newLanguage = language === 'English' ? 'Hebrew' : 'English';
    setLanguage(newLanguage);
    // Save to localStorage whenever language changes
    localStorage.setItem('preferredLanguage', newLanguage);
  };

  const setLanguageDirectly = (newLanguage) => {
    setLanguage(newLanguage);
    // Save to localStorage whenever language changes
    localStorage.setItem('preferredLanguage', newLanguage);
  };

  // Effect to update localStorage when language changes (backup)
  useEffect(() => {
    localStorage.setItem('preferredLanguage', language);
  }, [language]);

  const t = (key, interpolationValues = {}) => {
    const keys = key.split('.');
    let value = currentTranslations;
    
    for (const k of keys) {
      value = value?.[k];
      if (value === undefined) {
        console.warn(`Translation key "${key}" not found for language "${language}"`);
        return interpolationValues.defaultValue || key; // Return the key if translation is not found
      }
    }
    
    let result = value || interpolationValues.defaultValue || key;
    
    // Handle interpolation
    if (typeof result === 'string' && interpolationValues) {
      Object.keys(interpolationValues).forEach(placeholder => {
        if (placeholder !== 'defaultValue') {
          const regex = new RegExp(`{{${placeholder}}}`, 'g');
          result = result.replace(regex, interpolationValues[placeholder]);
        }
      });
    }
    
    return result;
  };

  const isRTL = language === 'Hebrew';

  return (
    <LanguageContext.Provider value={{
      language,
      setLanguage: setLanguageDirectly,
      toggleLanguage,
      t,
      isRTL,
      currentTranslations
    }}>
      <div className={isRTL ? 'rtl' : 'ltr'} dir={isRTL ? 'rtl' : 'ltr'}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
};