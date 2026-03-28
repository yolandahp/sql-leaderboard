from django.contrib import admin
from .models import User, Challenge, Submission

admin.site.register(User)
admin.site.register(Challenge)
admin.site.register(Submission)
