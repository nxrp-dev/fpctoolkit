program %PROJECT_NAME%;
{$mode objfpc}{$H+}

uses
  SysUtils;

procedure ShowUsage;
begin
  WriteLn('Usage: %PROJECT_NAME% <name>');
end;

begin
  if ParamCount = 0 then
  begin
    ShowUsage;
    Halt(1);
  end;

  WriteLn('Hello, ', ParamStr(1), '!');
end.
