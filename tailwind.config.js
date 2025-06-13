/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}", "./src/**/*.{js,jsx}", "./src/**/*.html"],
  darkMode: ["class"],
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		fontFamily: {
  			syne: [
  				'Syne',
  				'sans-serif'
  			],
  			'roboto-condensed': [
  				'Roboto Condensed',
  				'sans-serif'
  			]
  		},
  		container: {
  			center: true,
  			padding: {
  				default: '1rem',
				xs: '2rem',
  				sm: '2rem',
  				lg: '1rem'
  			},
  			screens: {
  				xs: '100%',
  				sm: '640px',
  				md: '768px',
  				lg: '1024px',
  				xl: '1280px',
  				xxl: '1585px'
  			}
  		},
  		fontSize: {
  			tabsheading: '20px',
  			xxltabsheading: '32px',
  			xltabsheading: '30px',
  			lgtabsheading: '28px',
  			mdtabsheading: '25px',
  			smtabsheading: '22px',
  			swapheading: '22px',
  			xxlswapheading: '40px',
  			xlswapheading: '35px',
  			lgswapheading: '30px',
  			mdswapheading: '26px',
  			smswapheading: '24px'
  		},
  		colors: {
			// Cool-toned gray system (cyberpunk-ready)
			gray: {
				50: 'hsl(210 20% 98%)',     // Very light cool gray
				100: 'hsl(210 20% 95%)',    // Light cool gray
				200: 'hsl(210 15% 85%)',    // Cool gray
				300: 'hsl(210 15% 75%)',    // Medium cool gray
				400: 'hsl(210 10% 60%)',    // Dark cool gray
				500: 'hsl(210 10% 45%)',    // Darker cool gray
				600: 'hsl(210 15% 35%)',    // Very dark cool gray
				700: 'hsl(210 20% 25%)',    // Almost black cool
				800: 'hsl(210 25% 15%)',    // Dark slate
				900: 'hsl(210 30% 8%)',     // Very dark slate
			},
			
			// Core semantic color system using CSS variables
			border: 'hsl(var(--color-border-primary))',
			input: 'hsl(var(--color-border-muted))',
			ring: 'hsl(var(--ring))',
			background: 'hsl(var(--color-background-primary))',
			foreground: 'hsl(var(--color-text-primary))',
			
			// Interactive colors
			primary: {
				DEFAULT: 'hsl(var(--color-interactive-primary))',
				foreground: 'hsl(var(--color-text-accent))'
			},
			secondary: {
				DEFAULT: 'hsl(var(--color-interactive-secondary))',
				foreground: 'hsl(var(--color-text-primary))'
			},
			
			// Status colors
			info: {
				DEFAULT: 'hsl(var(--color-status-info))',
				foreground: 'hsl(var(--color-status-info-fg))'
			},
			warning: {
				DEFAULT: 'hsl(var(--color-status-warning))',
				foreground: 'hsl(var(--color-status-warning-fg))'
			},
			destructive: {
				DEFAULT: 'hsl(var(--color-status-error))',
				foreground: 'hsl(var(--color-status-error-fg))'
			},
			constructive: {
				DEFAULT: 'hsl(var(--color-status-success))',
				foreground: 'hsl(var(--color-status-success-fg))'
			},
			
			// Layout colors
			muted: {
				DEFAULT: 'hsl(var(--color-background-muted))',
				foreground: 'hsl(var(--color-text-secondary))'
			},
			accent: {
				DEFAULT: 'hsl(var(--color-background-accent))',
				foreground: 'hsl(var(--color-text-primary))'
			},
			popover: {
				DEFAULT: 'hsl(var(--color-background-secondary))',
				foreground: 'hsl(var(--color-text-primary))'
			},
			card: {
				DEFAULT: 'hsl(var(--color-background-secondary))',
				foreground: 'hsl(var(--color-text-primary))'
			},
			
			// Chart colors using CSS variables
			chart: {
				primary: 'hsl(var(--color-chart-primary))',
				secondary: 'hsl(var(--color-chart-secondary))',
				accent: 'hsl(var(--color-chart-accent))',
				success: 'hsl(var(--color-chart-success))',
				warning: 'hsl(var(--color-chart-warning))',
				error: 'hsl(var(--color-chart-error))'
			},
			
			// Theme-specific semantic colors (replace hardcoded usage)
			multycolor: 'hsl(var(--color-interactive-accent))',    // Replace #FF9900
			brightyellow: 'hsl(var(--color-text-accent))',        // Replace #F6F930
			multygray: 'hsl(var(--color-text-secondary))',        // Replace #808080
			lightgray: 'hsl(var(--color-border-muted))',          // Replace #CCCCCC
			radiocolor: 'hsl(var(--color-background-accent))',    // Replace #353535
			swapinput: 'hsl(var(--color-interactive-primary))',   // Replace #32524D
			swaptext: 'hsl(var(--color-text-secondary))',         // Replace #5C5C5C
			swapvalue: 'hsl(var(--color-interactive-primary))',   // Replace #31524E
			darkgray: 'hsl(var(--color-text-secondary))',         // Replace #525252
			
			// Standard colors
			white: '#FFFFFF',
			black: '#000000',
			transparent: 'transparent',
			current: 'currentColor',
		},
  		backgroundColor: {
			// Replace hardcoded backgrounds with semantic roles
			balancebox: 'hsl(var(--color-interactive-primary))',  // Replace #3A3630
			sendbtnbg: 'hsl(var(--color-status-error))',         // Replace #FF3737
			mintbtnbg: 'hsl(var(--color-status-success))',       // Replace #92FF71
			receive: 'hsl(var(--color-status-success))'          // Replace #92FF71
		},
  		borderRadius: {
  			lg: '`var(--radius)`',
  			md: '`calc(var(--radius) - 2px)`',
  			sm: 'calc(var(--radius) - 4px)',
  			borderbox: '44px',
  			bordertb: '20px'
  		},
  		height: {
  			circleheight: '32px',
  			inputbox: '66px'
  		},
  		width: {
  			circlewidth: '32px'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		},
  		backgroundImage: {},
  		screens: {
  			xs: '280px'
  		}
  	}
  },
  variants: {
    extend: {
      opacity: ["disabled"],
      cursor: ["disabled"],
      pointerEvents: ["disabled"],
    },
  },
  plugins: [
	require("tailwindcss-animate"),
	require('tailwind-scrollbar'),
  ],
};
