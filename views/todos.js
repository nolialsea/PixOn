/*global $*/
/*global io*/

var socket = io(); // TIP: io() with no args does auto-discovery

var password = "";

socket.emit('getAllTasks');

$("#formTask").on("submit", function(e){
    e.preventDefault();
    if ($("#inpTask").val() != null && $("#inpTask").val() != ""){
        socket.emit('task', $("#inpTask").val());
    }
    $("#inpTask").val("");
});

function addTask(task){
    $('#ulTasks').prepend(
        "<li class='"+(task.done == 1 ? "checked" : "")+"' id='task_"+task.id+"'>"+
            "<button class='delete' onclick='removeTask("+task.id+")'>&times;</button>"+
            (task.task ? "<span class='text'>"+task.task+"</span>" : "")+
        "</li>"
    );
    $("#taskCounter").html((parseInt($("#taskCounter").html()) + 1).toString());
}

function removeTask(id){
    socket.emit('deleteTask', id);
}

socket.on('task', function(task){
    addTask(task);
});

socket.on('deleteTask', function(taskId){
    $("#ulTasks").children("#task_"+taskId).remove();
});

socket.on('allTasks', function(tasks){
    $('#ulTasks').empty();
    for (var i=0; i<tasks.length; i++){
        addTask(tasks[i]);
    }
});