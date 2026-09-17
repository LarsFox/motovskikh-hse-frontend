include .env

default: a

r:
	@npm run render

c:
	@cp -r src/css/* docs/css
	@cp -r src/js/* docs/js
	@echo 'Copied!'

co:
	@npm run compress
	@npm run hashes
	@echo 'Compressed!'

data:
	@npm run tasks
	@mkdir -p docs/countrypath/data/flags
	@cp -r src/countrypath/data/* docs/countrypath/data
	@echo 'Data copied!'

a: co data r
rc: r c
