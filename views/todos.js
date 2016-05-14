/*global $*/
/*global io*/

Date.prototype.yyyymmdd = function() {
 var yyyy = this.getFullYear().toString();
 var mm = (this.getMonth()+1).toString(); // getMonth() is zero-based
 var dd  = this.getDate().toString();
 return yyyy + "-" + (mm[1]?mm:"0"+mm[0])+ "-" + (dd[1]?dd:"0"+dd[0]); // padding
};

var t = $('#tasks').DataTable( {
  "order": [[ 4, "desc" ]],
  "columns": [
    { "width": "20%" },
    { "width": "50%" },
    { "width": "5%" },
    { "width": "5%" },
    { "width": "10%" },
    { "width": "10%" }
  ]
});

var socket = io(); // TIP: io() with no args does auto-discovery

var password = "";

socket.emit('getAllTasks');

$("#formTask").on("submit", function(e){
    e.preventDefault();
    if ($("#inpTask").val() != null && $("#inpTask").val() != ""){
        socket.emit('task', {task: $("#inpTask").val(), feature: $("#inpFeature").val()});
    }
    $("#inpTask").val("");
});

function addTask(task){
    t.row.add([
      task.feature ? task.feature : "None",
      task.task,
      task.accepted ? true : false,
      task.done + "%",
      new Date(task.dateCreation).yyyymmdd(),
      'None <button type="button" class="btn btn-default btn-xs" aria-label="Left Align"><span class="glyphicon glyphicon-remove" aria-hidden="true"></span></button>'
    ]).draw(false);
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
