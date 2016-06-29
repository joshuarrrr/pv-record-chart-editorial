#!/usr/bin/env python

import base_filters

COPY_GOOGLE_DOC_KEY = '1leI8_-Al9v3dHFi1-HopDbfetcqr2R9yfnU_RtzHzM8'

AIRTABLE_KEY = os.environ.get('AIRTABLE_ACCESS_KEY')

AIRTABLE_ENDPOINTS = [
	{
		'name': 'records',
		'url':'https://api.airtable.com/v0/appdED0QPblKKMq68/Efficiency%20Records?maxRecords=1000&view=Main%20View&api_key={}&sortField=DateTime&sortDirection=desc'.format(AIRTABLE_KEY)
	},
	{
		'name': 'cell-types',
		'url':'https://api.airtable.com/v0/appdED0QPblKKMq68/Cell%20Types?maxRecords=100&view=Main%20View&api_key={}&sortField=_createdTime&sortDirection=desc'.format(AIRTABLE_KEY)
	},
	{
		'name': 'institutions',
		'url':'https://api.airtable.com/v0/appdED0QPblKKMq68/Institutions?maxRecords=100&view=Main%20View&api_key={}&sortField=_createdTime&sortDirection=desc'.format(AIRTABLE_KEY)
	},
	{
		'name': 'cell-categories',
		'url':'https://api.airtable.com/v0/appdED0QPblKKMq68/Cell%20Categories?maxRecords=100&view=Main%20View&api_key={}&sortField=_createdTime&sortDirection=desc'.format(AIRTABLE_KEY)
	},
	{
		'name': 'references',
		'url':'https://api.airtable.com/v0/appdED0QPblKKMq68/References?maxRecords=100&view=Main%20View&api_key={}&sortField=_createdTime&sortDirection=desc'.format(AIRTABLE_KEY)
	}
]

USE_ASSETS = False

# Use these variables to override the default cache timeouts for this graphic
# DEFAULT_MAX_AGE = 20
# ASSETS_MAX_AGE = 300

JINJA_FILTER_FUNCTIONS = base_filters.FILTERS
