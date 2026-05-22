program %PROJECT_NAME%;
{$mode objfpc}{$H+}

uses
  SysUtils,
  %PROJECT_NAME%unit;

begin
  WriteLn('%PROJECT_NAME% - Program with Unit Example');
  SayHello('Pascal');
  WriteLn('Press Enter to exit...');
  ReadLn;
end.
