"""Support translation locales for InvenTree.

If a new language translation is supported, it must be added here
After adding a new language, run the following command:

python manage.py makemessages -l <language_code> -e html,js,py --no-wrap
 - where <language_code> is the code for the new language

Additionally, update the following files with the new locale code:

- /src/frontend/.linguirc file
- /src/frontend/src/contexts/LanguageContext.tsx

(and then run "invoke int.frontend-trans")
"""

from django.utils.translation import gettext_lazy as _

LOCALES = [
    ('vi', _('Vietnamese')),
    ('en', _('English')),
]
