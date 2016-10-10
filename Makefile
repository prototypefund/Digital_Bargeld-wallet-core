src = lib background content_scripts pages popup
ts = $(shell git ls-files $(src) | grep '\.tsx\?$$')
poname = taler-wallet-webex

gulp = node_modules/gulp/bin/gulp.js
tsc = node_modules/typescript/bin/tsc
po2json = node_modules/po2json/bin/po2json

.PHONY: pogen i18n/strings.js

package-stable: tsc i18n
	$(gulp) package-stable

package-unstable: tsc i18n
	$(gulp) package-unstable

tsc: tsconfig.json
	$(tsc)

tsconfig.json: gulpfile.js
	$(gulp) tsconfig

i18n: pogen msgmerge i18n/strings.js

pogen/pogen.js: pogen/pogen.ts pogen/tsconfig.json
	cd pogen; ../$(tsc)

pogen: $(ts) pogen/pogen.js
	find $(src) \( -name '*.ts' -or -name '*.tsx' \) ! -name '*.d.ts' \
	  | xargs node pogen/pogen.js \
	  | msguniq \
	  | msgmerge i18n/poheader - \
	  > i18n/$(poname).pot

msgmerge:
	@for pofile in i18n/*.po; do \
	  echo merging $$pofile; \
	  msgmerge -o $$pofile $$pofile i18n/$(poname).pot; \
	done; \

dist:
	$(gulp) srcdist

appdist:
	$(gulp) appdist

i18n/strings.js: # $(ts)
	cp i18n/strings-prelude.js i18n/strings.js
	for pofile in i18n/*.po; do \
	  b=`basename $$pofile`; \
	  lang=$${b%%.po}; \
	  $(po2json) -F -f jed1.x -d $$lang $$pofile $$pofile.json; \
	  (echo -n "i18n.strings['$$lang'] = "; cat $$pofile.json; echo ';') >> $@; \
	done

