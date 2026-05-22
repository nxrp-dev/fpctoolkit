program %PROJECT_NAME%;
{$mode objfpc}{$H+}

uses
  Interfaces, Forms, MainForm;

begin
  RequireDerivedFormResource := True;
  Application.Scaled := True;
  Application.Initialize;
  Application.CreateForm(TMainForm, MainFormInstance);
  Application.Run;
end.
