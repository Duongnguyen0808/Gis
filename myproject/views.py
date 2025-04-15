
#from django.http import HttpResponse
from django.shortcuts import render

def homepage(request):
    #return HttpResponse("Hello Django") 
    return render(request,'home.html')

def aboutpage(request):
    #return HttpResponse("This is the introduction page")  
    return render(request,'about.html')