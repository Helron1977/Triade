#!/bin/bash
git filter-branch --force --index-filter "git rm --cached --ignore-unmatch -r -f ile-de-france.zip dist-cli scripts/osm_data" --prune-empty --tag-name-filter cat -- --all
