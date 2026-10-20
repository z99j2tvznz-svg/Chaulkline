s=$1; cd /tmp/claude-0/fr
node bin/subsample.js d60/$s d30/$s 2 0; node bin/subsample.js d60/$s d30b/$s 2 1; node bin/subsample.js d60/$s d15/$s 4 0; node bin/subsample.js d60/$s d15b/$s 4 2
