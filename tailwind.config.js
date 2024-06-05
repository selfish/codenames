module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                // sans: ['Alef', 'Arial', 'sans-serif'],
            },
        },
    },
    plugins: [
        require('@tailwindcss/aspect-ratio'),
    ],
};
