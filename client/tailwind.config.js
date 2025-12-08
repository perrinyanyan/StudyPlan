module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      typography: {
        xs: {
          css: {
            fontSize: '0.75rem', // text-xs
            lineHeight: '1.25rem',
            p: {
              marginTop: '0.2em',
              marginBottom: '0.2em',
            },
            'ul > li': {
              marginTop: '0.1em',
              marginBottom: '0.1em',
              paddingLeft: '0', // Let component handle or default
            },
            'ol > li': {
              marginTop: '0.1em',
              marginBottom: '0.1em',
              paddingLeft: '0',
            },
            h1: {
              fontSize: '1em', // Keep relative or small
              marginTop: '0.5em',
              marginBottom: '0.3em',
            },
            h2: {
              fontSize: '0.9em',
              marginTop: '0.4em',
              marginBottom: '0.2em',
            },
            h3: {
              fontSize: '0.85em',
              marginTop: '0.3em',
              marginBottom: '0.1em',
            },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
