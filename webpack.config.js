import webpack from 'webpack'
import path from 'path'
import fileSystem from 'fs'

const alias = {}

const secretsPath = path.join(__dirname, `secrets.${ process.env.NODE_ENV }.js`)

if (fileSystem.existsSync(secretsPath)) {
	alias.secrets = secretsPath
}

const outputPath = path.join(__dirname, 'dist')
const publicPath = '/'

export default {
	devtool: 'inline-source-map',
	entry: {
		index: path.join(__dirname, 'src', 'index.ts'),
		relationships: path.join(__dirname, 'src', 'relationships.ts'),
	},
	output: {
		path: outputPath,
		filename: '[name].js',
		publicPath
	},
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				use: ['ts-loader']
			},
			{
				test: /\.json$/,
				use: ['json-loader']
			}
		]
	},
	resolve: {
		alias,
		extensions: ['.ts', '.tsx', '.js'],
		modules: [
			path.resolve('./src'),
			path.resolve('./src/Relationships')
		]
	},
	plugins: [
		new webpack.DefinePlugin({
			'process.env': {
				NODE_ENV: JSON.stringify(process.env.NODE_ENV),
				PORT: JSON.stringify(process.env.PORT)
			}
		})
	]
}