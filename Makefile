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

a: co r
rc: r c
